import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { DiscordAPIError } from "@discordjs/rest";
import { sendMessage, getGuildChannels } from "../lib/discord";
import { adminOnly } from "../middleware/admin-only";

const messages = new Hono();

// Apply admin middleware to all routes
messages.use("*", adminOnly);

const sendMessageSchema = z.object({
  channelId: z.string().min(1),
  content: z.string().min(1).max(2000),
});

// Send a message to a channel
messages.post("/", zValidator("json", sendMessageSchema), async (c) => {
  const { channelId, content } = c.req.valid("json");

  try {
    // Verify the channel belongs to our guild
    const guildChannels = await getGuildChannels();
    const channelExists = guildChannels.some((ch) => ch.id === channelId);

    if (!channelExists) {
      return c.json({ error: "Channel not found in guild" }, 404);
    }

    const result = await sendMessage(channelId, content);
    return c.json({ success: true, message: result });
  } catch (error) {
    console.error("Failed to send message:", error);

    if (error instanceof DiscordAPIError) {
      // 50001: Missing Access - Bot doesn't have permission to view/send in channel
      // 50013: Missing Permissions - Bot lacks specific permission
      if (error.code === 50001 || error.code === 50013) {
        return c.json(
          { error: "O bot não tem permissão para enviar mensagens neste canal" },
          403
        );
      }
    }

    return c.json({ error: "Falha ao enviar mensagem" }, 500);
  }
});

export { messages };
