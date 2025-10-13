import { redis } from "../config/redis";
import { RATE_LIMITS, REDIS_KEYS } from "../config/rate-limits";

export class RateLimiter {
  async canUserSendMessage(userId: string): Promise<{
    allowed: boolean;
    remainingSeconds?: number;
  }> {
    const key = REDIS_KEYS.userCooldown(userId);
    const ttl = await redis.ttl(key);

    if (ttl > 0) {
      return {
        allowed: false,
        remainingSeconds: ttl,
      };
    }

    return { allowed: true };
  }

  async setUserCooldown(userId: string, seconds?: number): Promise<void> {
    const key = REDIS_KEYS.userCooldown(userId);
    const cooldownTime = seconds ?? RATE_LIMITS.USER_COOLDOWN_SECONDS;
    await redis.setex(key, cooldownTime, "1");
  }

  async acquireGlobalSlot(): Promise<boolean> {
    const key = REDIS_KEYS.globalConcurrent;
    const current = await redis.incr(key);

    if (current > RATE_LIMITS.GLOBAL_CONCURRENT) {
      await redis.decr(key);
      return false;
    }

    return true;
  }

  async releaseGlobalSlot(): Promise<void> {
    const key = REDIS_KEYS.globalConcurrent;
    const current = await redis.get(key);

    if (current && parseInt(current, 10) > 0) {
      await redis.decr(key);
    }
  }

  async getCurrentConcurrency(): Promise<number> {
    const key = REDIS_KEYS.globalConcurrent;
    const current = await redis.get(key);
    return current ? parseInt(current, 10) : 0;
  }

  async isChannelProcessing(channelId: string): Promise<boolean> {
    const key = REDIS_KEYS.channelProcessing(channelId);
    const exists = await redis.exists(key);
    return exists === 1;
  }

  async markChannelProcessing(
    channelId: string,
    expirySeconds = 300
  ): Promise<void> {
    const key = REDIS_KEYS.channelProcessing(channelId);
    await redis.setex(key, expirySeconds, "1");
  }

  async unmarkChannelProcessing(channelId: string): Promise<void> {
    const key = REDIS_KEYS.channelProcessing(channelId);
    await redis.del(key);
  }
}

export const rateLimiter = new RateLimiter();
