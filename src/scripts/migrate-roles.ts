import {
  Client,
  GatewayDispatchEvents,
  GatewayIntentBits,
} from "@discordjs/core";
import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import axios, { AxiosError } from "axios";

import dotenv from "dotenv";
dotenv.config();

(async () => {
  const isProduction = process.env.NODE_ENV === "prod";

  const FREEMIUM_ROLE_ID = isProduction
    ? "1403038020642275389"
    : "1433233637444288605";
  const PREMIUM_ROLE_ID = isProduction
    ? "1407855781872799845"
    : "1433233614367097002";

  const rest = new REST({ version: "10" }).setToken(
    process.env.DISCORD_TOKEN ?? ""
  );

  const gateway = new WebSocketManager({
    token: process.env.DISCORD_TOKEN,
    intents:
      GatewayIntentBits.Guilds |
      GatewayIntentBits.GuildMessages |
      GatewayIntentBits.MessageContent |
      GatewayIntentBits.GuildMembers,
    rest,
  });

  const client = new Client({ rest, gateway });

  client.once(GatewayDispatchEvents.Ready, async ({ data, api }) => {
    const botId = data.user.id;
    console.log(`Ready! Logged in as ${data.user.username}`);

    const guildId = process.env.DISCORD_GUILD_ID;

    if (!guildId) {
      console.error("❌ DISCORD_GUILD_ID not found in environment variables");
      process.exit(1);
    }

    console.log(`Fetching guild with ID: ${guildId}`);

    try {
      const guild = await api.guilds.get(guildId);
      console.log(`✅ Guild found: ${guild.name}`);

      const members = await api.guilds.getMembers(guildId);
      console.log(`✅ Found ${members.length} members`);

      console.log({ guild, members });

      console.log(`${process.env.BEROLAB_API_ENDPOINT}/discord`);

      try {
        const blabReq = await axios.get(
          `${process.env.BEROLAB_API_ENDPOINT}/discord`,
          {
            headers: {
              Cookie: `__Host-next-auth.csrf-token=${process.env.BEROLAB_AUTH_CSRF_TOKEN}; __Secure-next-auth.callback-url=${process.env.BEROLAB_AUTH_CALLBACK_URL}; next-auth.session-token=${process.env.BEROLAB_AUTH_TOKEN}`,
            },
          }
        );

        const blabMembers = blabReq.data;

        console.log({ blabMembers });
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error("❌ Error fetching blab members:", error.message);
        } else {
          console.error("❌ Error fetching blab members:", error);
        }
      }

      process.exit(0);
    } catch (error) {
      console.error("❌ Error fetching guild:", error);
      console.error(`Make sure the bot is in the guild with ID: ${guildId}`);
      process.exit(1);
    }
  });

  gateway.connect();
})();
