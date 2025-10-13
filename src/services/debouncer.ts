import { redis } from "../config/redis";
import { RATE_LIMITS, REDIS_KEYS } from "../config/rate-limits";

interface DebounceData {
  messages: string[];
  channelId: string;
  timestamp: number;
}

export class Debouncer {
  async addMessage(
    userId: string,
    message: string,
    channelId: string
  ): Promise<{
    shouldProcess: boolean;
    messages?: string[];
  }> {
    const key = REDIS_KEYS.debounce(userId);
    const existingData = await redis.get(key);

    const now = Date.now();

    if (existingData) {
      const data: DebounceData = JSON.parse(existingData);

      if (now - data.timestamp < RATE_LIMITS.DEBOUNCE_WINDOW_MS) {
        data.messages.push(message);
        data.timestamp = now;

        await redis.setex(
          key,
          Math.ceil(RATE_LIMITS.DEBOUNCE_WINDOW_MS / 1000),
          JSON.stringify(data)
        );

        return {
          shouldProcess: false,
        };
      } else {
        const allMessages = [...data.messages, message];
        await redis.del(key);

        return {
          shouldProcess: true,
          messages: allMessages,
        };
      }
    }

    const newData: DebounceData = {
      messages: [message],
      channelId,
      timestamp: now,
    };

    await redis.setex(
      key,
      Math.ceil(RATE_LIMITS.DEBOUNCE_WINDOW_MS / 1000),
      JSON.stringify(newData)
    );

    return {
      shouldProcess: false,
    };
  }

  async getAndClearMessages(userId: string): Promise<string[]> {
    const key = REDIS_KEYS.debounce(userId);
    const existingData = await redis.get(key);

    if (!existingData) {
      return [];
    }

    const data: DebounceData = JSON.parse(existingData);
    await redis.del(key);

    return data.messages;
  }

  async hasDebounceData(userId: string): Promise<boolean> {
    const key = REDIS_KEYS.debounce(userId);
    const exists = await redis.exists(key);
    return exists === 1;
  }
}

export const debouncer = new Debouncer();
