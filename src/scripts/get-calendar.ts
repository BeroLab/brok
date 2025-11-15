import dotenv from "dotenv";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import {
  fetchWeeklyEvents,
  findLatestEvent,
  generateTwitterMessage,
  buildEventEmbed,
} from "../utils/event-helpers";

dotenv.config();

(async () => {
  console.log("📅 Berolab Weekly Calendar Fetcher\n");

  const berolabEndpoint = process.env.BEROLAB_API_ENDPOINT;
  const berolabToken = process.env.BEROLAB_AUTH_TOKEN;
  const discordToken = process.env.DISCORD_TOKEN;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (!berolabEndpoint) {
    console.error("❌ BEROLAB_API_ENDPOINT not found in environment variables");
    process.exit(1);
  }

  if (!berolabToken) {
    console.error("❌ BEROLAB_AUTH_TOKEN not found in environment variables");
    process.exit(1);
  }

  if (!discordToken) {
    console.error("❌ DISCORD_TOKEN not found in environment variables");
    process.exit(1);
  }

  if (!openrouterKey) {
    console.error("❌ OPENROUTER_API_KEY not found in environment variables");
    process.exit(1);
  }

  console.log("📡 Fetching events from Berolab API...\n");

  try {
    const events = await fetchWeeklyEvents(berolabEndpoint, berolabToken);

    console.log("✅ Events fetched successfully!\n");
    console.log(`📊 Total events found: ${events.length}\n`);

    if (events.length === 0) {
      console.log("ℹ️  No events found for this week.");
      process.exit(0);
    }

    const latestEvent = findLatestEvent(events);

    if (!latestEvent) {
      console.log("ℹ️  No events found.");
      process.exit(0);
    }

    console.log("🎯 Latest event found:");
    console.log(`   Title: ${latestEvent.title}`);
    console.log(`   Type: ${latestEvent.type}`);
    console.log(`   Start: ${latestEvent.start_at}`);
    console.log(
      `   Description: ${latestEvent.description.substring(0, 100)}...\n`
    );

    console.log("🤖 Generating promotional message with AI...\n");

    const openrouter = createOpenRouter({
      apiKey: openrouterKey,
    });

    const model = openrouter("google/gemini-2.0-flash-001");

    const twitterMessage = await generateTwitterMessage(latestEvent, model);

    console.log("✅ Twitter message generated:\n");
    console.log("=".repeat(80));
    console.log(twitterMessage);
    console.log("=".repeat(80));
    console.log("");

    console.log("📤 Sending event info to Discord...\n");

    const rest = new REST({ version: "10" }).setToken(discordToken);
    const channelId = "1371887722008150109";

    const embed = buildEventEmbed(latestEvent, twitterMessage);

    await rest.post(Routes.channelMessages(channelId), {
      body: {
        embeds: [embed],
      },
    });

    console.log("✅ Message sent successfully to Discord!\n");
    console.log(`   Channel ID: ${channelId}`);
    console.log(`   Event: ${latestEvent.title}\n`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error in calendar script\n");

    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
    } else {
      console.error(`   Unknown error:`, error);
    }

    process.exit(1);
  }
})();
