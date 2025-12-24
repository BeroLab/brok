import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../lib/prisma";
import { adminOnly } from "../middleware/admin-only";
import { rest, guildId } from "../lib/discord";
import { Routes, type APIGuildMember } from "discord-api-types/v10";
import type { AdminUser } from "../../generated/prisma";

type Variables = {
  admin: AdminUser;
};

const users = new Hono<{ Variables: Variables }>();

users.use("*", adminOnly);

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  after: z.string().optional(),
  search: z.string().optional(),
});

const updatePreferencesSchema = z.object({
  chatStyle: z.enum(["informative", "acid", "laele"]),
});

const banSchema = z.object({
  reason: z.string().max(500).optional(),
});

// List Discord guild members with pagination
users.get("/", zValidator("query", paginationSchema), async (c) => {
  const { limit, after, search } = c.req.valid("query");

  // Fetch guild members from Discord API
  const params = new URLSearchParams({ limit: String(limit) });
  if (after) params.set("after", after);

  const members = (await rest.get(Routes.guildMembers(guildId), {
    query: params,
  })) as APIGuildMember[];

  // Filter by search if provided
  let filteredMembers = members;
  if (search) {
    const searchLower = search.toLowerCase();
    filteredMembers = members.filter(
      (m) =>
        m.user?.username.toLowerCase().includes(searchLower) ||
        m.nick?.toLowerCase().includes(searchLower) ||
        m.user?.global_name?.toLowerCase().includes(searchLower)
    );
  }

  // Get discord IDs
  const discordIds = filteredMembers
    .map((m) => m.user?.id)
    .filter((id): id is string => !!id);

  // Fetch preferences and ban status for these users
  const [preferences, latestBans] = await Promise.all([
    prisma.userPreferences.findMany({
      where: { discordUserId: { in: discordIds } },
    }),
    // Get latest ban action for each user
    prisma.userBan.groupBy({
      by: ["discordUserId"],
      where: { discordUserId: { in: discordIds } },
      _max: { createdAt: true },
    }),
  ]);

  // Get the actual latest ban records
  const latestBanRecords = await prisma.userBan.findMany({
    where: {
      OR: latestBans.map((b) => ({
        discordUserId: b.discordUserId,
        createdAt: b._max.createdAt!,
      })),
    },
  });

  const prefsMap = new Map(preferences.map((p) => [p.discordUserId, p]));
  const bansMap = new Map(latestBanRecords.map((b) => [b.discordUserId, b]));

  const enrichedMembers = filteredMembers.map((member) => {
    const discordId = member.user?.id;
    const prefs = discordId ? prefsMap.get(discordId) : undefined;
    const latestBan = discordId ? bansMap.get(discordId) : undefined;

    return {
      discordId: member.user?.id,
      username: member.user?.username,
      globalName: member.user?.global_name,
      nickname: member.nick,
      avatar: member.user?.avatar,
      joinedAt: member.joined_at,
      hasInteracted: !!prefs,
      chatStyle: prefs?.chatStyle,
      isBanned: latestBan?.action === "ban",
    };
  });

  // Determine next cursor
  const lastMember = members[members.length - 1];
  const nextCursor = members.length === limit ? lastMember?.user?.id : undefined;

  return c.json({
    items: enrichedMembers,
    nextCursor,
  });
});

const historyPaginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

const searchSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().min(1).max(10).default(10),
});

// Search guild members by name/username (for mentions)
users.get("/search", zValidator("query", searchSchema), async (c) => {
  const { q, limit } = c.req.valid("query");

  // Use Discord's search endpoint
  const members = (await rest.get(
    `/guilds/${guildId}/members/search?query=${encodeURIComponent(q)}&limit=${limit}`
  )) as APIGuildMember[];

  const results = members.map((member) => ({
    discordId: member.user?.id,
    username: member.user?.username,
    globalName: member.user?.global_name,
    nickname: member.nick,
    avatar: member.user?.avatar,
  }));

  return c.json(results);
});

// List currently banned users
users.get("/banned", async (c) => {
  // Get all unique discord IDs that have ban records
  const allBans = await prisma.userBan.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Group by discordUserId and get the latest action
  const latestByUser = new Map<string, (typeof allBans)[0]>();
  for (const ban of allBans) {
    if (!latestByUser.has(ban.discordUserId)) {
      latestByUser.set(ban.discordUserId, ban);
    }
  }

  // Filter only currently banned users
  const bannedUserIds = Array.from(latestByUser.entries())
    .filter(([, ban]) => ban.action === "ban")
    .map(([id]) => id);

  // Fetch Discord info for banned users
  const bannedUsers = await Promise.all(
    bannedUserIds.map(async (discordId) => {
      const banRecord = latestByUser.get(discordId)!;
      let discordInfo = null;

      try {
        const member = (await rest.get(
          Routes.guildMember(guildId, discordId)
        )) as APIGuildMember;
        discordInfo = {
          username: member.user?.username,
          globalName: member.user?.global_name,
          avatar: member.user?.avatar,
        };
      } catch {
        // User may have left the server
      }

      return {
        discordId,
        username: discordInfo?.username ?? "Unknown",
        globalName: discordInfo?.globalName,
        avatar: discordInfo?.avatar,
        bannedAt: banRecord.createdAt,
        bannedBy: banRecord.bannedBy,
        bannedByName: banRecord.bannedByName,
        reason: banRecord.reason,
      };
    })
  );

  return c.json(bannedUsers);
});

// Get ban/unban history log
users.get("/bans/history", zValidator("query", historyPaginationSchema), async (c) => {
  const { limit, offset } = c.req.valid("query");

  const [history, total] = await Promise.all([
    prisma.userBan.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.userBan.count(),
  ]);

  // Fetch Discord usernames for the history entries
  const discordIds = [...new Set(history.map((h) => h.discordUserId))];
  const usernames = new Map<string, string>();

  await Promise.all(
    discordIds.map(async (discordId) => {
      try {
        const member = (await rest.get(
          Routes.guildMember(guildId, discordId)
        )) as APIGuildMember;
        usernames.set(discordId, member.user?.username ?? "Unknown");
      } catch {
        usernames.set(discordId, "Unknown");
      }
    })
  );

  const enrichedHistory = history.map((entry) => ({
    ...entry,
    username: usernames.get(entry.discordUserId) ?? "Unknown",
  }));

  return c.json({
    items: enrichedHistory,
    total,
    limit,
    offset,
  });
});

// Get single user details
users.get("/:discordId", async (c) => {
  const { discordId } = c.req.param();

  // Fetch member from Discord
  let member: APIGuildMember;
  try {
    member = (await rest.get(
      Routes.guildMember(guildId, discordId)
    )) as APIGuildMember;
  } catch {
    return c.json({ error: "User not found in guild" }, 404);
  }

  // Fetch preferences and ban history
  const [preferences, banHistory] = await Promise.all([
    prisma.userPreferences.findUnique({
      where: { discordUserId: discordId },
    }),
    prisma.userBan.findMany({
      where: { discordUserId: discordId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const latestBan = banHistory[0];

  return c.json({
    discordId: member.user?.id,
    username: member.user?.username,
    globalName: member.user?.global_name,
    nickname: member.nick,
    avatar: member.user?.avatar,
    joinedAt: member.joined_at,
    roles: member.roles,
    preferences: preferences
      ? {
          chatStyle: preferences.chatStyle,
          createdAt: preferences.createdAt,
          updatedAt: preferences.updatedAt,
        }
      : null,
    isBanned: latestBan?.action === "ban",
    banHistory,
  });
});

// Update user preferences
users.patch(
  "/:discordId/preferences",
  zValidator("json", updatePreferencesSchema),
  async (c) => {
    const { discordId } = c.req.param();
    const { chatStyle } = c.req.valid("json");

    const preferences = await prisma.userPreferences.upsert({
      where: { discordUserId: discordId },
      update: { chatStyle },
      create: { discordUserId: discordId, chatStyle },
    });

    return c.json(preferences);
  }
);

// Ban user
users.post("/:discordId/ban", zValidator("json", banSchema), async (c) => {
  const { discordId } = c.req.param();
  const { reason } = c.req.valid("json");
  const admin = c.get("admin");

  // Check if already banned
  const latestBan = await prisma.userBan.findFirst({
    where: { discordUserId: discordId },
    orderBy: { createdAt: "desc" },
  });

  if (latestBan?.action === "ban") {
    return c.json({ error: "User is already banned" }, 400);
  }

  const ban = await prisma.userBan.create({
    data: {
      discordUserId: discordId,
      action: "ban",
      reason,
      bannedBy: admin.discordId,
      bannedByName: admin.discordName,
    },
  });

  return c.json(ban, 201);
});

// Unban user
users.post("/:discordId/unban", zValidator("json", banSchema), async (c) => {
  const { discordId } = c.req.param();
  const { reason } = c.req.valid("json");
  const admin = c.get("admin");

  // Check if actually banned
  const latestBan = await prisma.userBan.findFirst({
    where: { discordUserId: discordId },
    orderBy: { createdAt: "desc" },
  });

  if (!latestBan || latestBan.action !== "ban") {
    return c.json({ error: "User is not banned" }, 400);
  }

  const unban = await prisma.userBan.create({
    data: {
      discordUserId: discordId,
      action: "unban",
      reason,
      bannedBy: admin.discordId,
      bannedByName: admin.discordName,
    },
  });

  return c.json(unban, 201);
});

export { users };
