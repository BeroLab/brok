import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../lib/prisma";
import { adminOnly } from "../middleware/admin-only";

const admins = new Hono();

admins.use("*", adminOnly);

const createAdminSchema = z.object({
  discordId: z.string().min(1),
  discordName: z.string().min(1).max(100),
});

const updateAdminSchema = z.object({
  discordName: z.string().min(1).max(100).optional(),
});

// List all admins
admins.get("/", async (c) => {
  const allAdmins = await prisma.adminUser.findMany({
    orderBy: { createdAt: "desc" },
  });
  return c.json(allAdmins);
});

// Get single admin by ID
admins.get("/:id", async (c) => {
  const { id } = c.req.param();

  const admin = await prisma.adminUser.findUnique({
    where: { id },
  });

  if (!admin) {
    return c.json({ error: "Admin not found" }, 404);
  }

  return c.json(admin);
});

// Create new admin
admins.post("/", zValidator("json", createAdminSchema), async (c) => {
  const data = c.req.valid("json");

  const existing = await prisma.adminUser.findUnique({
    where: { discordId: data.discordId },
  });

  if (existing) {
    return c.json({ error: "Admin with this Discord ID already exists" }, 409);
  }

  const admin = await prisma.adminUser.create({
    data: {
      discordId: data.discordId,
      discordName: data.discordName,
      role: "admin",
    },
  });

  return c.json(admin, 201);
});

// Update admin
admins.patch("/:id", zValidator("json", updateAdminSchema), async (c) => {
  const { id } = c.req.param();
  const data = c.req.valid("json");

  const existing = await prisma.adminUser.findUnique({
    where: { id },
  });

  if (!existing) {
    return c.json({ error: "Admin not found" }, 404);
  }

  const admin = await prisma.adminUser.update({
    where: { id },
    data,
  });

  return c.json(admin);
});

// Delete admin
admins.delete("/:id", async (c) => {
  const { id } = c.req.param();

  const existing = await prisma.adminUser.findUnique({
    where: { id },
  });

  if (!existing) {
    return c.json({ error: "Admin not found" }, 404);
  }

  await prisma.adminUser.delete({
    where: { id },
  });

  return c.json({ success: true });
});

export { admins };
