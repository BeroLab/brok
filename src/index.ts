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
import { PrismaClient, ChatStyle } from "./generated/prisma";
import { ObjectId } from "bson";
import { rateLimiter } from "./services/rate-limiter";
import { debouncer } from "./services/debouncer";
import { messageQueue, setWorkerContext } from "./services/message-queue";

const prisma = new PrismaClient();

const supportRoles = {
  engineers: {
    ids: ["1386522263708500000"],
    description: "bugs ou problemas técnicos com a plataforma",
  },
  moderators: {
    ids: ["1370538364964442122", "1394750906620313816"],
    description: "problemas com outros participantes ou comportamento inadequado",
  },
  mentors: {
    ids: ["1392531631385870427"],
    description: "dúvidas sobre mentoria ou funcionamento do site",
  },
};

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

const model = openrouter("qwen/qwen3-235b-a22b:free");

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

    let userId = message.author.id;
    let username = message.author.username;
    let messageId = message.id;
    let messageContent = message.content;
    const channelId = message.channel_id;

    if (message.referenced_message) {
      if (message.referenced_message.author.bot) {
        console.log(
          `⚠️  Ignoring reply to bot message from ${message.author.username}`
        );
        return;
      }

      userId = message.referenced_message.author.id;
      username = message.referenced_message.author.username;
      messageId = message.referenced_message.id;
      messageContent = message.referenced_message.content;

      console.log(
        `📨 Reply context detected! ${message.author.username} mentioned bot in reply to ${username}'s message: "${messageContent}"`
      );
    } else {
      console.log(
        `💬 Direct mention by ${message.author.username}: ${message.content}`
      );
    }

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
        console.log(
          `⏸️  Debouncing message from ${username}, will process in 4.5s`
        );
        setTimeout(async () => {
          const hasDebounce = await debouncer.hasDebounceData(userId);
          console.log(
            `⏰ Debounce timeout reached for ${userId}, hasDebounce: ${hasDebounce}`
          );
          if (hasDebounce) {
            const debounceData = await debouncer.getAndClearData(userId);
            if (debounceData.messages.length > 0) {
              console.log(
                `📨 Adding ${debounceData.messages.length} debounced messages to queue`
              );
              await messageQueue.add("process-message", {
                userId,
                username,
                channelId,
                messageId,
                messageContent: debounceData.messages.join("\n\n---\n\n"),
                botMention,
                feedbackMessageIds: [],
              });
            }
          }
        }, 4500);

        return;
      }

      console.log(
        `✅ Processing message immediately from ${username}`
      );

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
        username,
        channelId,
        messageId,
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
        const userRoles = interaction.member?.roles ?? [];
        const allSupportRoleIds = [
          ...supportRoles.engineers.ids,
          ...supportRoles.moderators.ids,
          ...supportRoles.mentors.ids,
        ];

        const hasPermission = userRoles.some((roleId) =>
          allSupportRoleIds.includes(roleId)
        );

        if (!hasPermission) {
          await api.interactions.reply(interaction.id, interaction.token, {
            content:
              "❌ Você não tem permissão para registrar perguntas no FAQ. Este comando é restrito à equipe de suporte.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

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

    if (command.data.name === "acido") {
      try {
        const userId =
          interaction.member?.user.id ?? interaction.user?.id ?? "";

        await prisma.userPreferences.upsert({
          where: {
            discordUserId: userId,
          },
          update: {
            chatStyle: ChatStyle.acid,
          },
          create: {
            id: new ObjectId().toString(),
            discordUserId: userId,
            chatStyle: ChatStyle.acid,
          },
        });

        await api.interactions.reply(interaction.id, interaction.token, {
          content:
            "🔥 Modo ácido ativado! agora eu vou ser sem filtro, com zoeira pesada e verdades desconfortáveis. bora! 💀",
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        console.error("Error setting acid mode:", error);
        await api.interactions.reply(interaction.id, interaction.token, {
          content: "❌ deu ruim aqui. tenta de novo depois.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    if (command.data.name === "informativo") {
      try {
        const userId =
          interaction.member?.user.id ?? interaction.user?.id ?? "";

        await prisma.userPreferences.upsert({
          where: {
            discordUserId: userId,
          },
          update: {
            chatStyle: ChatStyle.informative,
          },
          create: {
            id: new ObjectId().toString(),
            discordUserId: userId,
            chatStyle: ChatStyle.informative,
          },
        });

        await api.interactions.reply(interaction.id, interaction.token, {
          content:
            "✅ Modo informativo ativado! agora eu volto a ser educado e útil. tmj! 🤙",
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        console.error("Error setting informative mode:", error);
        await api.interactions.reply(interaction.id, interaction.token, {
          content: "❌ deu ruim aqui. tenta de novo depois.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    if (command.data.name === "laele") {
      try {
        const userId =
          interaction.member?.user.id ?? interaction.user?.id ?? "";

        await prisma.userPreferences.upsert({
          where: {
            discordUserId: userId,
          },
          update: {
            chatStyle: ChatStyle.laele,
          },
          create: {
            id: new ObjectId().toString(),
            discordUserId: userId,
            chatStyle: ChatStyle.laele,
          },
        });

        await api.interactions.reply(interaction.id, interaction.token, {
          content:
            "😎 Modo laele ativado! bora de brotheragem, só tiradas rápidas e zoeira leve. tá ligado? 🔥",
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        console.error("Error setting laele mode:", error);
        await api.interactions.reply(interaction.id, interaction.token, {
          content: "❌ deu ruim aqui. tenta de novo depois.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  }
);

gateway.connect();
