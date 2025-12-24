import type { Context, Next } from "hono";
import { ObjectId } from "mongodb";
import { auth } from "../lib/auth";
import { db } from "../lib/mongodb";
import { prisma } from "../lib/prisma";
import type { AdminUser } from "../../generated/prisma";

type AdminVariables = {
  admin: AdminUser;
  userId: string;
};

export async function adminOnly(
  c: Context<{ Variables: AdminVariables }>,
  next: Next
) {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Get Discord account ID from MongoDB (Better Auth stores accounts there)
  // userId in MongoDB is ObjectId, but session.user.id is string
  const account = await db.collection("account").findOne({
    userId: new ObjectId(session.user.id),
    providerId: "discord",
  });

  if (!account) {
    return c.json({ error: "Discord account not linked" }, 403);
  }

  // Check if Discord ID is in the admin whitelist (stored in Prisma)
  const admin = await prisma.adminUser.findUnique({
    where: { discordId: account.accountId },
  });

  if (!admin) {
    return c.json({ error: "Forbidden - Not an admin" }, 403);
  }

  c.set("admin", admin);
  c.set("userId", session.user.id);
  return next();
}
