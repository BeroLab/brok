import { CronJob } from "cron";
import { migrateRoles } from "./migrate-roles";
import { Client } from "@discordjs/core";

export function startMigrationCronJob(api: Client["api"], botId: string) {
  console.log("[CRON] 🕒 Scheduling role migration job...");

  const migrateRolesJob = new CronJob(
    "*/10 * * * *",
    async () => {
      try {
        console.log("[CRON] 🚀 Starting scheduled role migration...");
        const stats = await migrateRoles(api, botId);
        console.log(
          `[CRON] ✅ Scheduled role migration finished successfully. Added/Removed: ${
            stats.premiumAdded +
            stats.premiumRemoved +
            stats.freemiumAdded +
            stats.freemiumRemoved
          }`,
        );
      } catch (error) {
        console.error("[CRON] ❌ Scheduled role migration failed:", error);
      }
    },
    null,
    true,
    "America/Sao_Paulo",
  );

  console.log(
    `[CRON] ✅ Role migration job scheduled. Next run: ${migrateRolesJob
      .nextDate()
      .toString()}`,
  );
}
