import { Queue, Worker, Job } from "bullmq";
import type { API } from "@discordjs/core";
import { Routes } from "discord-api-types/v10";
import { REST } from "@discordjs/rest";
import type { LanguageModelV1 } from "ai";
import {
  fetchWeeklyEvents,
  findTodayEvent,
  generateTwitterMessage,
  buildEventEmbed,
} from "../utils/event-helpers";

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  throw new Error("REDIS_URL environment variable is not set");
}

const connection = {
  url: REDIS_URL,
};

export interface DailyEventJobData {
  scheduledTime: string;
}

export interface DailyEventContext {
  model: LanguageModelV1;
  discordToken: string;
  berolabEndpoint: string;
  berolabToken: string;
  channelId: string;
}

let workerContext: DailyEventContext | null = null;

export function setDailyEventContext(context: DailyEventContext): void {
  workerContext = context;
}

export const dailyEventQueue = new Queue<DailyEventJobData>(
  "daily-event-notifications",
  {
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
        count: 50,
        age: 7 * 24 * 3600,
      },
    },
  }
);

export const dailyEventWorker = new Worker<DailyEventJobData>(
  "daily-event-notifications",
  async (job: Job<DailyEventJobData>) => {
    console.log(
      `🔔 Processing daily event check job ${job.id} at ${job.data.scheduledTime}`
    );

    if (!workerContext) {
      throw new Error("Daily event worker context not initialized");
    }

    const { model, discordToken, berolabEndpoint, berolabToken, channelId } =
      workerContext;

    try {
      console.log("📡 Fetching weekly events from Berolab API...");
      const events = await fetchWeeklyEvents(berolabEndpoint, berolabToken);

      console.log(`📊 Found ${events.length} events this week`);

      const todayEvent = findTodayEvent(events);

      if (!todayEvent) {
        console.log("ℹ️  No events scheduled for today. Skipping notification.");
        return { success: true, message: "No events today", eventSent: false };
      }

      console.log(`🎯 Event found for today: ${todayEvent.title}`);
      console.log(`   Type: ${todayEvent.type}`);
      console.log(`   Start: ${todayEvent.start_at}`);

      console.log("🤖 Generating Twitter message with AI...");
      const twitterMessage = await generateTwitterMessage(todayEvent, model);

      console.log("📝 Building Discord embed...");
      const embed = buildEventEmbed(todayEvent, twitterMessage);

      console.log(`📤 Sending notification to Discord channel ${channelId}...`);
      const rest = new REST({ version: "10" }).setToken(discordToken);

      await rest.post(Routes.channelMessages(channelId), {
        body: {
          embeds: [embed],
        },
      });

      console.log("✅ Daily event notification sent successfully!");
      console.log(`   Event: ${todayEvent.title}`);
      console.log(`   Channel: ${channelId}`);

      return {
        success: true,
        message: "Event notification sent",
        eventSent: true,
        eventTitle: todayEvent.title,
      };
    } catch (error) {
      console.error("❌ Error processing daily event job:", error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 1,
  }
);

export async function initializeDailyEventScheduler(
  context: DailyEventContext
): Promise<void> {
  console.log("🕐 Initializing daily event scheduler...");

  setDailyEventContext(context);

  const existingJobs = await dailyEventQueue.getRepeatableJobs();

  for (const job of existingJobs) {
    console.log(`   Removing existing job: ${job.id}`);
    await dailyEventQueue.removeRepeatableByKey(job.key);
  }

  await dailyEventQueue.add(
    "check-daily-event",
    {
      scheduledTime: new Date().toISOString(),
    },
    {
      repeat: {
        pattern: "0 9 * * *",
        tz: "America/Sao_Paulo",
      },
    }
  );

  console.log("✅ Daily event scheduler initialized successfully");
  console.log("   Schedule: Every day at 9:00 AM (America/Sao_Paulo)");
  console.log(`   Target channel: ${context.channelId}`);
}

dailyEventWorker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

dailyEventWorker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed with error:`, err.message);
});
