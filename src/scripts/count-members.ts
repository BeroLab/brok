import {
  Client,
  GatewayDispatchEvents,
  GatewayIntentBits,
} from "@discordjs/core";
import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import dotenv from "dotenv";

dotenv.config();

(async () => {
  console.log("🤖 Discord Member Counter\n");

  const rest = new REST({ version: "10" }).setToken(
    process.env.DISCORD_TOKEN ?? ""
  );

  const gateway = new WebSocketManager({
    token: process.env.DISCORD_TOKEN,
    intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMembers,
    rest,
  });

  const client = new Client({ rest, gateway });

  client.once(GatewayDispatchEvents.Ready, async ({ data, api }) => {
    console.log(`Ready! Logged in as ${data.user.username}\n`);

    const guildId = process.env.DISCORD_GUILD_ID;

    if (!guildId) {
      console.error("❌ DISCORD_GUILD_ID not found in environment variables");
      process.exit(1);
    }

    console.log(`Fetching guild with ID: ${guildId}`);

    try {
      const guild = await api.guilds.get(guildId);
      console.log(`✅ Guild found: ${guild.name} (${guildId})\n`);

      console.log("📥 Fetching all members (with pagination)...");
      const members = [];
      let lastMemberId: string | undefined;
      let fetchedCount = 0;
      let hasMore = true;

      while (hasMore) {
        const chunk = await api.guilds.getMembers(guildId, {
          limit: 1000,
          after: lastMemberId,
        });

        fetchedCount += chunk.length;
        members.push(...chunk);

        if (chunk.length > 0) {
          lastMemberId = chunk[chunk.length - 1]?.user?.id;
          console.log(`   Fetched ${fetchedCount} members so far...`);
        }

        hasMore = chunk.length === 1000;
      }

      console.log("\n" + "=".repeat(50));
      console.log(`📊 Total members: ${members.length}`);
      console.log("=".repeat(50) + "\n");

      process.exit(0);
    } catch (error) {
      console.error("❌ Error fetching guild:", error);
      console.error(`Make sure the bot is in the guild with ID: ${guildId}`);
      process.exit(1);
    }
  });

  gateway.connect();
})();
