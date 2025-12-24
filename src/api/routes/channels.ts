import { Hono } from "hono";
import { getGuildChannels } from "../lib/discord";
import { adminOnly } from "../middleware/admin-only";

const channels = new Hono();

// Apply admin middleware to all routes
channels.use("*", adminOnly);

// List all text channels in the guild
channels.get("/", async (c) => {
  try {
    const allChannels = await getGuildChannels();

    const mapped = allChannels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      parentId: "parent_id" in channel ? channel.parent_id : null,
    }));

    return c.json(mapped);
  } catch (error) {
    console.error("Failed to fetch channels:", error);
    return c.json({ error: "Failed to fetch channels" }, 500);
  }
});

export { channels };
