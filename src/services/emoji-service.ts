import type { API } from "@discordjs/core";
import { redis } from "../config/redis";

export interface GuildEmoji {
  id: string;
  name: string;
  animated: boolean;
}

const EMOJI_CACHE_TTL = 3600;
const EMOJI_CACHE_PREFIX = "guild_emojis:";

export class EmojiService {
  private api: API;

  constructor(api: API) {
    this.api = api;
  }

  async getGuildEmojis(guildId: string): Promise<GuildEmoji[]> {
    try {
      const cacheKey = `${EMOJI_CACHE_PREFIX}${guildId}`;
      const cached = await redis.get(cacheKey);

      if (cached) {
        return JSON.parse(cached) as GuildEmoji[];
      }

      const emojis = await this.api.guilds.getEmojis(guildId);

      const processedEmojis: GuildEmoji[] = emojis
        .filter((emoji) => emoji.id && emoji.name)
        .map((emoji) => ({
          id: emoji.id!,
          name: emoji.name!,
          animated: emoji.animated ?? false,
        }));

      await redis.setex(cacheKey, EMOJI_CACHE_TTL, JSON.stringify(processedEmojis));

      return processedEmojis;
    } catch (error) {
      console.error(`Failed to fetch emojis for guild ${guildId}:`, error);
      return [];
    }
  }

  formatEmoji(emoji: GuildEmoji): string {
    const prefix = emoji.animated ? "a" : "";
    return `<${prefix}:${emoji.name}:${emoji.id}>`;
  }

  formatEmojiListForPrompt(emojis: GuildEmoji[]): string {
    if (emojis.length === 0) {
      return "No custom emojis available in this server.";
    }

    const emojiList = emojis
      .map((emoji) => {
        const formatted = this.formatEmoji(emoji);
        const type = emoji.animated ? "(animated)" : "(static)";
        return `- ${emoji.name} ${type}: ${formatted}`;
      })
      .join("\n");

    return `Available custom emojis in this server:\n${emojiList}`;
  }
}
