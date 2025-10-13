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
import { generateText } from "ai";
import { IDENTITY_PROMPT } from "./ai/prompts";
import { PrismaClient } from "./generated/prisma";
import { ObjectId } from "bson";

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
});

client.on(
  GatewayDispatchEvents.MessageCreate,
  async ({ data: message, api }) => {
    if (message.author.bot) return;

    const botMention = `<@${botId}>`;
    if (!message.content.includes(botMention)) return;

    console.log(
      `Bot mentioned by ${message.author.username}: ${message.content}`
    );

    try {
      const thinkingMessage = await api.channels.createMessage(
        message.channel_id,
        {
          content: "🤔 perai to pensando...",
          message_reference: {
            message_id: message.id,
          },
        }
      );

      const userMessage = message.content.replace(botMention, "").trim();

      const existentFAQ = await prisma.fAQ.findMany();

      const supportRoleMentions = supportRoles
        .map((roleId) => `<@&${roleId}>`)
        .join(" ");

      const { text } = await generateText({
        model,
        prompt: `
        ${IDENTITY_PROMPT}
        ${userMessage}

        FAQ disponíveis: ${JSON.stringify(existentFAQ)}

        O usuário te mencionou, leia as perguntas e respostas que temos salvas no banco de dados e veja se já temos uma resposta para a solicitação do usuário. Caso não tivermos, pense em uma resposta que faz sentido.

        Caso o usuário faça uma pergunta específica que envolve informações sensíveis como pagamentos, regras, suporte técnico, ou qualquer assunto que requeira atenção da equipe, você DEVE incluir a seguinte linha ao final da sua resposta:

        "galera deem uma olhada aqui ${supportRoleMentions}"

        Use seu julgamento para determinar se a pergunta requer escalonamento para a equipe de suporte.
        `,
      });

      await api.channels.editMessage(message.channel_id, thinkingMessage.id, {
        content: text,
      });
    } catch (error) {
      console.error("Error generating AI response:", error);
      await api.channels.createMessage(message.channel_id, {
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
