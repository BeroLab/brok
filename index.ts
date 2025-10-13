import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import {
  GatewayDispatchEvents,
  GatewayIntentBits,
  Client,
} from "@discordjs/core";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

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

    console.log(`Bot mentioned by ${message.author.username}: ${message.content}`);

    try {
      const thinkingMessage = await api.channels.createMessage(message.channel_id, {
        content: "🤔 perai to pensando...",
        message_reference: {
          message_id: message.id,
        },
      });

      const userMessage = message.content.replace(botMention, "").trim();

      const { text } = await generateText({
        model,
        prompt: userMessage,
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

gateway.connect();
