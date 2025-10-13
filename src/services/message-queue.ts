import { Queue, Worker, Job } from "bullmq";
import type { API } from "@discordjs/core";
import { generateText } from "ai";
import { rateLimiter } from "./rate-limiter";
import { debouncer } from "./debouncer";
import { RATE_LIMITS } from "../config/rate-limits";
import { IDENTITY_PROMPT, ACID_PROMPT } from "../ai/prompts";
import type { PrismaClient, ChatStyle } from "../generated/prisma";

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  throw new Error("REDIS_URL environment variable is not set");
}

const connection = {
  url: REDIS_URL,
};

export interface MessageJobData {
  userId: string;
  username: string;
  channelId: string;
  messageId: string;
  messageContent: string;
  botMention: string;
  feedbackMessageIds: string[];
}

export interface MessageJobContext {
  api: API;
  model: unknown;
  identityPrompt: string;
  supportRoles: string[];
  prisma: PrismaClient;
}

export const messageQueue = new Queue<MessageJobData>("ai-messages", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 3600,
    },
    removeOnFail: {
      count: 1000,
      age: 7 * 24 * 3600,
    },
  },
});

let workerContext: MessageJobContext | null = null;

export function setWorkerContext(context: MessageJobContext): void {
  workerContext = context;
}

export const messageWorker = new Worker<MessageJobData>(
  "ai-messages",
  async (job: Job<MessageJobData>) => {
    console.log(`🚀 Processing job ${job.id} for user ${job.data.userId}`);

    if (!workerContext) {
      throw new Error("Worker context not initialized");
    }

    const { api, model, identityPrompt, supportRoles, prisma } = workerContext;
    const {
      userId,
      channelId,
      messageId,
      messageContent,
      botMention,
      feedbackMessageIds,
    } = job.data;

    let slotAcquired = false;
    let typingInterval: NodeJS.Timeout | null = null;

    try {
      slotAcquired = await rateLimiter.acquireGlobalSlot();

      if (!slotAcquired) {
        throw new Error("Global concurrency limit reached");
      }

      await rateLimiter.markChannelProcessing(channelId);

      for (const feedbackId of feedbackMessageIds) {
        try {
          await api.channels.deleteMessage(channelId, feedbackId);
        } catch (error) {
          console.error(
            `Failed to delete feedback message ${feedbackId}:`,
            error
          );
        }
      }

      const debounceMessages =
        (await debouncer.getAndClearMessages(userId)) || [];
      const allMessages =
        debounceMessages.length > 0 ? debounceMessages : [messageContent];

      const combinedMessage = allMessages
        .map((msg) => msg.replace(botMention, "").trim())
        .join("\n\n---\n\n");

      await api.channels.showTyping(channelId);

      typingInterval = setInterval(async () => {
        try {
          await api.channels.showTyping(channelId);
        } catch (error) {
          console.error("Failed to show typing:", error);
        }
      }, 8000);

      const existentFAQ = await prisma.fAQ.findMany();

      console.log(`🔍 Looking up preferences for user ${userId}`);
      const userPreferences = await prisma.userPreferences.findUnique({
        where: {
          discordUserId: userId,
        },
      });

      console.log(`🎯 User preferences:`, userPreferences);
      const selectedPrompt =
        userPreferences?.chatStyle === "acid" ? ACID_PROMPT : IDENTITY_PROMPT;
      console.log(`🗣️  Using ${userPreferences?.chatStyle === "acid" ? "ACID" : "INFORMATIVE"} prompt`);

      const supportRoleMentions = supportRoles
        .map((roleId) => `<@&${roleId}>`)
        .join(" ");

      const { text } = await generateText({
        model: model as any,
        prompt: `
        ${selectedPrompt}
        ${combinedMessage}

        FAQ disponíveis: ${JSON.stringify(existentFAQ)}

        O usuário te mencionou, leia as perguntas e respostas que temos salvas no banco de dados e veja se já temos uma resposta para a solicitação do usuário. Caso não tivermos, pense em uma resposta que faz sentido.

        Caso o usuário faça uma pergunta específica que envolve informações sensíveis como pagamentos, regras, suporte técnico, ou qualquer assunto que requeira atenção da equipe, você DEVE incluir a seguinte linha ao final da sua resposta:

        "galera deem uma olhada aqui ${supportRoleMentions}"

        Use seu julgamento para determinar se a pergunta requer escalonamento para a equipe de suporte.
        `,
      });

      if (typingInterval) {
        clearInterval(typingInterval);
      }

      console.log(`📤 Sending response to channel ${channelId}...`);
      await api.channels.createMessage(channelId, {
        content: text,
        message_reference: {
          message_id: messageId,
        },
      });
      console.log(`✅ Response sent successfully!`);

      await rateLimiter.setUserCooldown(userId);

      return { success: true };
    } finally {
      if (typingInterval) {
        clearInterval(typingInterval);
      }
      if (slotAcquired) {
        await rateLimiter.releaseGlobalSlot();
      }
      await rateLimiter.unmarkChannelProcessing(channelId);
    }
  },
  {
    connection,
    concurrency: RATE_LIMITS.GLOBAL_CONCURRENT,
    limiter: {
      max: RATE_LIMITS.GLOBAL_CONCURRENT,
      duration: 1000,
    },
  }
);

messageWorker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

messageWorker.on("failed", async (job, err) => {
  console.error(`❌ Job ${job?.id} failed after all retries:`, err);

  if (job && workerContext) {
    try {
      const { channelId, messageId } = job.data;
      const { api } = workerContext;

      await api.channels.createMessage(channelId, {
        content:
          "❌ po deu ruim aqui. tentei várias vezes mas deu algum erro. me marca de novo depois, tmj 🤙",
        message_reference: {
          message_id: messageId,
        },
      });
    } catch (notifyError) {
      console.error("Failed to send error notification:", notifyError);
    }
  }
});

messageWorker.on("error", (err) => {
  console.error("❌ Worker error:", err);
});

console.log("🚀 Message queue worker started");
