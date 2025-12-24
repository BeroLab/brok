import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../lib/prisma";
import { adminOnly } from "../middleware/admin-only";

const prompts = new Hono();

// Apply admin middleware to all routes
prompts.use("*", adminOnly);

const createPromptSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  content: z.string().min(1),
  isActive: z.boolean().default(true),
});

const updatePromptSchema = createPromptSchema.partial().omit({ slug: true });

// List all prompts
prompts.get("/", async (c) => {
  const allPrompts = await prisma.prompt.findMany({
    orderBy: { createdAt: "desc" },
  });
  return c.json(allPrompts);
});

// Get single prompt by slug
prompts.get("/:slug", async (c) => {
  const { slug } = c.req.param();
  const prompt = await prisma.prompt.findUnique({
    where: { slug },
  });

  if (!prompt) {
    return c.json({ error: "Prompt not found" }, 404);
  }

  return c.json(prompt);
});

// Create new prompt
prompts.post("/", zValidator("json", createPromptSchema), async (c) => {
  const data = c.req.valid("json");

  const existing = await prisma.prompt.findUnique({
    where: { slug: data.slug },
  });

  if (existing) {
    return c.json({ error: "Prompt with this slug already exists" }, 409);
  }

  const prompt = await prisma.prompt.create({
    data,
  });

  return c.json(prompt, 201);
});

// Update prompt
prompts.patch("/:slug", zValidator("json", updatePromptSchema), async (c) => {
  const { slug } = c.req.param();
  const data = c.req.valid("json");

  const existing = await prisma.prompt.findUnique({
    where: { slug },
  });

  if (!existing) {
    return c.json({ error: "Prompt not found" }, 404);
  }

  const prompt = await prisma.prompt.update({
    where: { slug },
    data,
  });

  return c.json(prompt);
});

// Delete prompt
prompts.delete("/:slug", async (c) => {
  const { slug } = c.req.param();

  const existing = await prisma.prompt.findUnique({
    where: { slug },
  });

  if (!existing) {
    return c.json({ error: "Prompt not found" }, 404);
  }

  await prisma.prompt.delete({
    where: { slug },
  });

  return c.json({ success: true });
});

// Toggle prompt active status
prompts.post("/:slug/toggle", async (c) => {
  const { slug } = c.req.param();

  const existing = await prisma.prompt.findUnique({
    where: { slug },
  });

  if (!existing) {
    return c.json({ error: "Prompt not found" }, 404);
  }

  const prompt = await prisma.prompt.update({
    where: { slug },
    data: { isActive: !existing.isActive },
  });

  return c.json(prompt);
});

export { prompts };
