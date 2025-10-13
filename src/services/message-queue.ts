import { Queue, Worker, Job } from "bullmq";
import type { API } from "@discordjs/core";
import { generateText } from "ai";
import { rateLimiter } from "./rate-limiter";
import { debouncer } from "./debouncer";
import { RATE_LIMITS } from "../config/rate-limits";
import { IDENTITY_PROMPT, ACID_PROMPT, LAELE_PROMPT } from "../ai/prompts";
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

export interface SupportRole {
  ids: string[];
  description: string;
}

export interface SupportRoles {
  engineers: SupportRole;
  moderators: SupportRole;
  mentors: SupportRole;
}

export interface MessageJobContext {
  api: API;
  model: unknown;
  identityPrompt: string;
  supportRoles: SupportRoles;
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

    const { api, model, supportRoles, prisma } = workerContext;
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

      let selectedPrompt = IDENTITY_PROMPT;
      let promptType = "INFORMATIVE";

      if (userPreferences?.chatStyle === "acid") {
        selectedPrompt = ACID_PROMPT;
        promptType = "ACID";
      } else if (userPreferences?.chatStyle === "laele") {
        selectedPrompt = LAELE_PROMPT;
        promptType = "LAELE";
      }

      console.log(`🗣️  Using ${promptType} prompt`);

      const roleCategories = {
        engineers: supportRoles.engineers.ids.map((id) => `<@&${id}>`).join(" "),
        moderators: supportRoles.moderators.ids
          .map((id) => `<@&${id}>`)
          .join(" "),
        mentors: supportRoles.mentors.ids.map((id) => `<@&${id}>`).join(" "),
      };

      const { text } = await generateText({
        model: model as any,
        prompt: `
        ${selectedPrompt}
        ${combinedMessage}

        FAQ disponíveis: ${JSON.stringify(existentFAQ)}

        O usuário te mencionou, leia as perguntas e respostas que temos salvas no banco de dados e veja se já temos uma resposta para a solicitação do usuário. Caso não tivermos, pense em uma resposta que faz sentido.

        Caso o usuário faça uma pergunta que requeira atenção da equipe, você deve escolher QUAL EQUIPE mencionar baseado no tipo de problema:

        CARGOS DISPONÍVEIS:
        - Engenheiros (${roleCategories.engineers}): Para ${supportRoles.engineers.description}
        - Moderadores (${roleCategories.moderators}): Para ${supportRoles.moderators.description}
        - Mentores (${roleCategories.mentors}): Para ${supportRoles.mentors.description}

        IMPORTANTE: Analise a pergunta e mencione APENAS o cargo apropriado. Por exemplo:
        - Bug na plataforma? Mencione: "galera deem uma olhada aqui ${roleCategories.engineers}"
        - Problema com outro usuário? Mencione: "galera deem uma olhada aqui ${roleCategories.moderators}"
        - Dúvida sobre mentoria? Mencione: "galera deem uma olhada aqui ${roleCategories.mentors}"

        Use seu julgamento para determinar se a pergunta realmente requer escalonamento (não escalone perguntas irônicas ou gerais que você pode responder).

        IMPORTANTE: Se alguém perguntar quem te criou, quem te programou, quem é seu desenvolvedor ou criador, mencione: <@875824126663749632>
        `,
      });

      const cleanedText = text
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
        .replace(/\(nenhuma info sensível aqui[^)]*\)/gi, "")
        .replace(/\(resposta direta do faq[^)]*\)/gi, "")
        .replace(/\[nenhuma ação necessária[^\]]*\]/gi, "")
        .trim();

      if (typingInterval) {
        clearInterval(typingInterval);
      }

      console.log(`📤 Sending response to channel ${channelId}...`);
      await api.channels.createMessage(channelId, {
        content: cleanedText,
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
