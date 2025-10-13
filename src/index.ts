import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import {
  GatewayDispatchEvents,
  GatewayIntentBits,
  Client,
  InteractionType,
  ApplicationCommandOptionType,
  MessageFlags,
  type APIChatInputApplicationCommandInteraction,
  type APIApplicationCommandInteractionDataStringOption,
} from "@discordjs/core";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { IDENTITY_PROMPT } from "./ai/prompts";
import { PrismaClient } from "./generated/prisma";
import { ObjectId } from "bson";
import { rateLimiter } from "./services/rate-limiter";
import { debouncer } from "./services/debouncer";
import { messageQueue, setWorkerContext } from "./services/message-queue";

const prisma = new PrismaClient();
const supportRoles = ["1427335784729673808"];

const rest = new REST({ version: "10" }).setToken(
  process.env.DISCORD_TOKEN ?? ""
);

const gateway = new WebSocketManager({
  token: process.env.DISCORD_TOKEN,
  intents:
    GatewayIntentBits.Guilds |
    GatewayIntentBits.GuildMessages |
    GatewayIntentBits.MessageContent,
  rest,
});

const client = new Client({ rest, gateway });

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
});

const model = openrouter("google/gemini-2.5-flash");

let botId: string;

client.once(GatewayDispatchEvents.Ready, ({ data }) => {
  botId = data.user.id;
  console.log(`Ready! Logged in as ${data.user.username}`);

  setWorkerContext({
    api: client.api,
    model,
    identityPrompt: IDENTITY_PROMPT,
    supportRoles,
    prisma,
  });

  console.log("✅ Worker context initialized");
});

client.on(
  GatewayDispatchEvents.MessageCreate,
  async ({ data: message, api }) => {
    if (message.author.bot) return;

    const botMention = `<@${botId}>`;
    if (!message.content.includes(botMention)) return;

    const userId = message.author.id;
    const channelId = message.channel_id;
    const messageContent = message.content;

    console.log(
      `Bot mentioned by ${message.author.username}: ${message.content}`
    );

    try {
      const isChannelBusy = await rateLimiter.isChannelProcessing(channelId);
      if (isChannelBusy) {
        await api.channels.createMessage(channelId, {
          content:
            "⚠️ já to respondendo outra mensagem aqui, peraí que logo respondo você!",
          message_reference: {
            message_id: message.id,
          },
        });
        return;
      }

      const cooldownCheck = await rateLimiter.canUserSendMessage(userId);
      if (!cooldownCheck.allowed) {
        await api.channels.createMessage(channelId, {
          content: `⏳ calma aí mano, espera mais ${cooldownCheck.remainingSeconds} segundos antes de me marcar de novo!`,
          message_reference: {
            message_id: message.id,
          },
        });
        return;
      }

      const debounceResult = await debouncer.addMessage(
        userId,
        messageContent,
        channelId
      );

      if (!debounceResult.shouldProcess) {
        setTimeout(async () => {
          const hasDebounce = await debouncer.hasDebounceData(userId);
          if (hasDebounce) {
            const debounceData = await debouncer.getAndClearData(userId);
            if (debounceData.messages.length > 0) {
              await messageQueue.add("process-message", {
                userId,
                username: message.author.username,
                channelId,
                messageId: message.id,
                messageContent: debounceData.messages.join("\n\n---\n\n"),
                botMention,
                feedbackMessageIds: [],
              });
            }
          }
        }, 5500);

        return;
      }

      const concurrencyCount = await rateLimiter.getCurrentConcurrency();
      if (concurrencyCount >= 5) {
        await api.channels.createMessage(channelId, {
          content:
            "🚦 to processando muita coisa agora, aguarda um pouquinho e me marca de novo!",
          message_reference: {
            message_id: message.id,
          },
        });
        return;
      }

      await messageQueue.add("process-message", {
        userId,
        username: message.author.username,
        channelId,
        messageId: message.id,
        messageContent,
        botMention,
        feedbackMessageIds: [],
      });
    } catch (error) {
      console.error("Error handling message:", error);
      await api.channels.createMessage(channelId, {
        content:
          "❌ po deu ruim aqui. deu algum erro. me marca de novo depois, tmj 🤙",
        message_reference: {
          message_id: message.id,
        },
      });
    }
  }
);

client.on(
  GatewayDispatchEvents.InteractionCreate,
  async ({ data: interaction, api }) => {
    if (interaction.type !== InteractionType.ApplicationCommand) return;

    const command = interaction as APIChatInputApplicationCommandInteraction;

    if (command.data.name === "registrar-faq") {
      try {
        const options = command.data.options ?? [];
        const pergunta = options.find(
          (opt): opt is APIApplicationCommandInteractionDataStringOption =>
            opt.name === "pergunta"
        );
        const resposta = options.find(
          (opt): opt is APIApplicationCommandInteractionDataStringOption =>
            opt.name === "resposta"
        );

        if (
          !pergunta ||
          pergunta.type !== ApplicationCommandOptionType.String ||
          !resposta ||
          resposta.type !== ApplicationCommandOptionType.String
        ) {
          await api.interactions.reply(interaction.id, interaction.token, {
            content: "❌ Erro ao processar os parâmetros do comando.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const faq = await prisma.fAQ.create({
          data: {
            id: new ObjectId().toString(),
            question: pergunta.value,
            answer: resposta.value,
            createdBy:
              interaction.member?.user.id ?? interaction.user?.id ?? "",
          },
        });

        await api.interactions.reply(interaction.id, interaction.token, {
          content: `✅ FAQ registrado com sucesso!\n\n**Pergunta:** ${faq.question}\n**Resposta:** ${faq.answer}`,
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        console.error("Error creating FAQ:", error);
        await api.interactions.reply(interaction.id, interaction.token, {
          content: "❌ Erro ao registrar o FAQ. Tente novamente mais tarde.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  }
);

gateway.connect();
