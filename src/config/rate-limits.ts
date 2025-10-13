export const RATE_LIMITS = {
  USER_COOLDOWN_SECONDS:
    parseInt(process.env.RATE_LIMIT_USER_COOLDOWN_SECONDS ?? "10", 10) || 10,
  GLOBAL_CONCURRENT:
    parseInt(process.env.RATE_LIMIT_GLOBAL_CONCURRENT ?? "5", 10) || 5,
  DEBOUNCE_WINDOW_MS:
    parseInt(process.env.DEBOUNCE_WINDOW_MS ?? "5000", 10) || 5000,
} as const;

export const REDIS_KEYS = {
  userCooldown: (userId: string) => `cooldown:${userId}`,
  globalConcurrent: "global:concurrent",
  channelProcessing: (channelId: string) => `processing:${channelId}`,
  debounce: (userId: string) => `debounce:${userId}`,
} as const;
