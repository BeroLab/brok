import { Client } from "@discordjs/core";
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

export async function migrateRoles(
  api: Client["api"],
  botId: string
): Promise<MigrationStats> {
  const isProduction = process.env.NODE_ENV === "prod";
  console.log(
    `[CRON] 🌍 Starting role migration. Environment: ${
      isProduction ? "PRODUCTION" : "DEVELOPMENT"
    }`
  );

  const FREEMIUM_ROLE_ID = "1403038020642275389";
  const PREMIUM_ROLE_ID = "1407855781872799845";

  console.log(`[CRON] 🎭 Using roles:`);
  console.log(`[CRON]    FREEMIUM: ${FREEMIUM_ROLE_ID}`);
  console.log(`[CRON]    PREMIUM: ${PREMIUM_ROLE_ID}\n`);

  const guildId = process.env.DISCORD_GUILD_ID;

  if (!guildId) {
    throw new Error(
      "[CRON] ❌ DISCORD_GUILD_ID not found in environment variables"
    );
  }

  console.log(`[CRON] Fetching guild with ID: ${guildId}`);

  try {
    const guild = await api.guilds.get(guildId);
    console.log(`[CRON] ✅ Guild found: ${guild.name} (${guildId})`);

    const guildRoles = await api.guilds.getRoles(guildId);
    const hasFreemiumRole = guildRoles.some((r) => r.id === FREEMIUM_ROLE_ID);
    const hasPremiumRole = guildRoles.some((r) => r.id === PREMIUM_ROLE_ID);

    if (!hasFreemiumRole || !hasPremiumRole) {
      let errorMessage = "[CRON] ❌ ERROR: Required roles not found in server!";
      if (!hasFreemiumRole) {
        errorMessage += `\n   Missing FREEMIUM role: ${FREEMIUM_ROLE_ID}`;
      }
      if (!hasPremiumRole) {
        errorMessage += `\n   Missing PREMIUM role: ${PREMIUM_ROLE_ID}`;
      }
      throw new Error(errorMessage);
    }

    console.log("[CRON] ✅ Roles validated in server");

    const botMember = await api.guilds.getMember(guildId, botId);
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

    console.log(`[CRON] \n🔍 Checking role hierarchy...`);
    console.log(`[CRON]    Bot's highest role position: ${botHighestPosition}`);
    console.log(
      `[CRON]    FREEMIUM role (${freemiumRole?.name}): position ${freemiumPosition}`
    );
    console.log(
      `[CRON]    PREMIUM role (${premiumRole?.name}): position ${premiumPosition}`
    );

    if (
      freemiumPosition >= botHighestPosition ||
      premiumPosition >= botHighestPosition
    ) {
      let errorMessage =
        "[CRON] ❌ HIERARCHY ERROR: Bot's role is below target roles!";
      if (premiumPosition >= botHighestPosition) {
        errorMessage += `\n   PREMIUM role is at position ${premiumPosition} (TOO HIGH)`;
      }
      if (freemiumPosition >= botHighestPosition) {
        errorMessage += `\n   FREEMIUM role is at position ${freemiumPosition} (TOO HIGH)`;
      }
      throw new Error(errorMessage);
    }

    console.log("[CRON] ✅ Role hierarchy is correct\n");

    console.log("[CRON] 📥 Fetching all members (with pagination)...");
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
        console.log(`[CRON]    Fetched ${fetchedCount} members so far...`);
      }

      hasMore = chunk.length === 1000;
    }

    console.log(
      `[CRON] ✅ Found ${members.length} total members in Discord server`
    );

    console.log(
      `[CRON] \n📡 Fetching members from BeroLab API: ${process.env.BEROLAB_API_ENDPOINT}/discord`
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
      console.log(
        `[CRON] ✅ Found ${blabMembers.length} members in BeroLab API`
      );
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(`[CRON] ❌ Error fetching blab members: ${error.message}`);
      } else {
        throw new Error(`[CRON] ❌ Error fetching blab members: ${error}`);
      }
    }

    const stats: MigrationStats = {
      total: blabMembers.length,
      alreadyCorrect: 0,
      premiumAdded: 0,
      premiumRemoved: 0,
      freemiumAdded: 0,
      freemiumRemoved: 0,
      errors: 0,
    };

    console.log("[CRON] \n🔄 Starting role migration...\n");

    for (const blabMember of blabMembers) {
      try {
        const discordMember = members.find(
          (m) => m.user?.id === blabMember.discordId
        );

        if (!discordMember) {
          console.log(
            `[CRON] ⚠️  User ${blabMember.discordId} not found in Discord server, skipping...`
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

        if (
          (blabMember.isPremium && hasPremium) ||
          (!blabMember.isPremium && hasFreemium)
        ) {
          stats.alreadyCorrect++;
          continue;
        }

        if (blabMember.isPremium) {
          if (hasFreemium) {
            await api.guilds.removeRoleFromMember(
              guildId,
              blabMember.discordId,
              FREEMIUM_ROLE_ID
            );
            stats.freemiumRemoved++;
            await sleep(500);
          }

          await api.guilds.addRoleToMember(
            guildId,
            blabMember.discordId,
            PREMIUM_ROLE_ID
          );
          stats.premiumAdded++;
        } else {
          if (hasPremium) {
            await api.guilds.removeRoleFromMember(
              guildId,
              blabMember.discordId,
              PREMIUM_ROLE_ID
            );
            stats.premiumRemoved++;
            await sleep(500);
          }

          await api.guilds.addRoleToMember(
            guildId,
            blabMember.discordId,
            FREEMIUM_ROLE_ID
          );
          stats.freemiumAdded++;
        }
        await sleep(1000);
      } catch (error) {
        stats.errors++;
        console.error(
          `[CRON]    ❌ Error processing user ${blabMember.discordId}:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 [CRON] MIGRATION SUMMARY");
    console.log("=".repeat(50));
    console.log(`Total members processed: ${stats.total}`);
    console.log(`Already correct: ${stats.alreadyCorrect}`);
    console.log(`PREMIUM roles added: ${stats.premiumAdded}`);
    console.log(`PREMIUM roles removed: ${stats.premiumRemoved}`);
    console.log(`FREEMIUM roles added: ${stats.freemiumAdded}`);
    console.log(`FREEMIUM roles removed: ${stats.freemiumRemoved}`);
    console.log(`Errors: ${stats.errors}`);
    console.log("=".repeat(50) + "\n");

    return stats;
  } catch (error) {
    console.error("[CRON] ❌ Error during role migration:", error);
    throw error;
  }
}
