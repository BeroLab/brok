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

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface BeroLabMember {
  discordId: string;
  isPremium: boolean;
  userId: string;
}

interface MigrationStats {
  total: number;
  alreadyCorrect: number;
  premiumAdded: number;
  premiumRemoved: number;
  freemiumAdded: number;
  freemiumRemoved: number;
  errors: number;
}

(async () => {
  const args = process.argv.slice(2);
  const isProdFlag = args.includes("--prod");

  const limitIndex = args.indexOf("--limit");
  let limit: number | undefined;

  if (limitIndex !== -1 && args[limitIndex + 1]) {
    const limitValue = parseInt(args[limitIndex + 1], 10);
    if (!isNaN(limitValue) && limitValue > 0) {
      limit = limitValue;
    } else {
      console.error("❌ Invalid --limit value. Must be a positive number.");
      console.log("\nUsage: bun migrate-roles [--limit N] [--prod]");
      process.exit(1);
    }
  }

  const isProduction = isProdFlag || process.env.NODE_ENV === "prod";

  console.log(`🌍 Environment: ${isProduction ? "PRODUCTION" : "DEVELOPMENT"}`);

  if (limit !== undefined) {
    console.log(`🧪 TEST MODE: Processing only ${limit} users`);
  }

  console.log("");

  // const FREEMIUM_ROLE_ID = isProduction
  //   ? "1403038020642275389"
  //   : "1433233637444288605";
  // const PREMIUM_ROLE_ID = isProduction
  //   ? "1407855781872799845"
  //   : "1433233614367097002";

  const FREEMIUM_ROLE_ID = "1403038020642275389";
  const PREMIUM_ROLE_ID = "1407855781872799845";

  console.log(`🎭 Using roles:`);
  console.log(`   FREEMIUM: ${FREEMIUM_ROLE_ID}`);
  console.log(`   PREMIUM: ${PREMIUM_ROLE_ID}\n`);

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
      console.log(`✅ Guild found: ${guild.name} (${guildId})`);

      const guildRoles = await api.guilds.getRoles(guildId);
      const hasFreemiumRole = guildRoles.some((r) => r.id === FREEMIUM_ROLE_ID);
      const hasPremiumRole = guildRoles.some((r) => r.id === PREMIUM_ROLE_ID);

      if (!hasFreemiumRole || !hasPremiumRole) {
        console.error("\n❌ ERROR: Required roles not found in this server!");
        if (!hasFreemiumRole) {
          console.error(`   Missing FREEMIUM role: ${FREEMIUM_ROLE_ID}`);
        }
        if (!hasPremiumRole) {
          console.error(`   Missing PREMIUM role: ${PREMIUM_ROLE_ID}`);
        }
        console.error(
          "\n💡 Tip: Make sure you're using the correct environment flag (--prod or dev)"
        );
        process.exit(1);
      }

      console.log("✅ Roles validated in server");

      const botMember = await api.guilds.getMember(guildId, data.user.id);
      const botRoles = botMember.roles;

      let botHighestPosition = 0;
      for (const roleId of botRoles) {
        const role = guildRoles.find((r) => r.id === roleId);
        if (role && role.position > botHighestPosition) {
          botHighestPosition = role.position;
        }
      }

      const freemiumRole = guildRoles.find((r) => r.id === FREEMIUM_ROLE_ID);
      const premiumRole = guildRoles.find((r) => r.id === PREMIUM_ROLE_ID);

      const freemiumPosition = freemiumRole?.position ?? 0;
      const premiumPosition = premiumRole?.position ?? 0;

      console.log(`\n🔍 Checking role hierarchy...`);
      console.log(`   Bot's highest role position: ${botHighestPosition}`);
      console.log(
        `   FREEMIUM role (${freemiumRole?.name}): position ${freemiumPosition}`
      );
      console.log(
        `   PREMIUM role (${premiumRole?.name}): position ${premiumPosition}`
      );

      if (
        freemiumPosition >= botHighestPosition ||
        premiumPosition >= botHighestPosition
      ) {
        console.error(
          "\n❌ HIERARCHY ERROR: Bot's role is below target roles!"
        );
        console.error(`   Bot's highest position: ${botHighestPosition}`);
        if (premiumPosition >= botHighestPosition) {
          console.error(
            `   PREMIUM role is at position ${premiumPosition} (TOO HIGH)`
          );
        }
        if (freemiumPosition >= botHighestPosition) {
          console.error(
            `   FREEMIUM role is at position ${freemiumPosition} (TOO HIGH)`
          );
        }
        console.error("\n💡 Solution: In Discord Server Settings > Roles:");
        console.error(
          "   Drag the bot's role ABOVE both PREMIUM and FREEMIUM roles\n"
        );
        process.exit(1);
      }

      console.log("✅ Role hierarchy is correct\n");

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

      console.log(`✅ Found ${members.length} total members in Discord server`);

      console.log(
        `\n📡 Fetching members from BeroLab API: ${process.env.BEROLAB_API_ENDPOINT}/discord`
      );

      let blabMembers: BeroLabMember[] = [];

      try {
        const blabReq = await axios.get<BeroLabMember[]>(
          `${process.env.BEROLAB_API_ENDPOINT}/discord`,
          {
            headers: {
              Cookie: `__Host-next-auth.csrf-token=${process.env.BEROLAB_AUTH_CSRF_TOKEN}; __Secure-next-auth.callback-url=${process.env.BEROLAB_AUTH_CALLBACK_URL}; next-auth.session-token=${process.env.BEROLAB_AUTH_TOKEN}`,
            },
          }
        );

        blabMembers = blabReq.data;
        console.log(`✅ Found ${blabMembers.length} members in BeroLab API`);
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error("❌ Error fetching blab members:", error.message);
        } else {
          console.error("❌ Error fetching blab members:", error);
        }
        process.exit(1);
      }

      const membersToProcess =
        limit !== undefined ? blabMembers.slice(0, limit) : blabMembers;

      const stats: MigrationStats = {
        total: membersToProcess.length,
        alreadyCorrect: 0,
        premiumAdded: 0,
        premiumRemoved: 0,
        freemiumAdded: 0,
        freemiumRemoved: 0,
        errors: 0,
      };

      console.log("\n🔄 Starting role migration...\n");

      for (const blabMember of membersToProcess) {
        try {
          const discordMember = members.find(
            (m) => m.user?.id === blabMember.discordId
          );

          if (!discordMember) {
            console.log(
              `⚠️  User ${blabMember.discordId} not found in Discord server, skipping...`
            );
            continue;
          }

          const userRoles = discordMember.roles ?? [];
          const hasPremium = userRoles.includes(PREMIUM_ROLE_ID);
          const hasFreemium = userRoles.includes(FREEMIUM_ROLE_ID);

          const expectedRole = blabMember.isPremium ? "PREMIUM" : "FREEMIUM";
          const currentRole = hasPremium
            ? "PREMIUM"
            : hasFreemium
            ? "FREEMIUM"
            : "NONE";

          console.log(
            `👤 ${discordMember.user?.username} (${blabMember.discordId}): Current=${currentRole}, Expected=${expectedRole}`
          );

          if (blabMember.isPremium && hasPremium) {
            console.log("   ✓ Already has correct PREMIUM role");
            stats.alreadyCorrect++;
            continue;
          }

          if (!blabMember.isPremium && hasFreemium) {
            console.log("   ✓ Already has correct FREEMIUM role");
            stats.alreadyCorrect++;
            continue;
          }

          let rolesModified = false;

          if (blabMember.isPremium) {
            if (hasFreemium) {
              console.log("   🔄 Removing FREEMIUM role...");
              await api.guilds.removeRoleFromMember(
                guildId,
                blabMember.discordId,
                FREEMIUM_ROLE_ID
              );
              stats.freemiumRemoved++;
              rolesModified = true;
              await sleep(500);
            }

            console.log("   ➕ Adding PREMIUM role...");
            await api.guilds.addRoleToMember(
              guildId,
              blabMember.discordId,
              PREMIUM_ROLE_ID
            );
            stats.premiumAdded++;
            console.log("   ✅ PREMIUM role added successfully");
            rolesModified = true;
          } else {
            if (hasPremium) {
              console.log("   🔄 Removing PREMIUM role...");
              await api.guilds.removeRoleFromMember(
                guildId,
                blabMember.discordId,
                PREMIUM_ROLE_ID
              );
              stats.premiumRemoved++;
              rolesModified = true;
              await sleep(500);
            }

            console.log("   ➕ Adding FREEMIUM role...");
            await api.guilds.addRoleToMember(
              guildId,
              blabMember.discordId,
              FREEMIUM_ROLE_ID
            );
            stats.freemiumAdded++;
            console.log("   ✅ FREEMIUM role added successfully");
            rolesModified = true;
          }

          if (rolesModified) {
            await sleep(1000);
          }
        } catch (error) {
          stats.errors++;
          console.error(
            `   ❌ Error processing user ${blabMember.discordId}:`,
            error instanceof Error ? error.message : error
          );
        }

        console.log("");
      }

      console.log("\n" + "=".repeat(50));
      console.log("📊 MIGRATION SUMMARY");
      console.log("=".repeat(50));
      if (limit !== undefined) {
        console.log(
          `🧪 TEST MODE: Processed ${stats.total} of ${blabMembers.length} total members`
        );
      }
      console.log(`Total members processed: ${stats.total}`);
      console.log(`Already correct: ${stats.alreadyCorrect}`);
      console.log(`PREMIUM roles added: ${stats.premiumAdded}`);
      console.log(`PREMIUM roles removed: ${stats.premiumRemoved}`);
      console.log(`FREEMIUM roles added: ${stats.freemiumAdded}`);
      console.log(`FREEMIUM roles removed: ${stats.freemiumRemoved}`);
      console.log(`Errors: ${stats.errors}`);
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
