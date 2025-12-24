import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../lib/prisma";
import { adminOnly } from "../middleware/admin-only";

const faqs = new Hono();

// Apply admin middleware to all routes
faqs.use("*", adminOnly);

const searchSchema = z.object({
  q: z.string().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

// Search FAQs
faqs.get("/", zValidator("query", searchSchema), async (c) => {
  const { q, limit, offset } = c.req.valid("query");

  const where = q
    ? {
        OR: [
          { question: { contains: q, mode: "insensitive" as const } },
          { answer: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.fAQ.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
    }),
    prisma.fAQ.count({ where }),
  ]);

  return c.json({
    items,
    total,
    limit,
    offset,
  });
});

// Get single FAQ by ID
faqs.get("/:id", async (c) => {
  const { id } = c.req.param();

  const faq = await prisma.fAQ.findUnique({
    where: { id },
  });

  if (!faq) {
    return c.json({ error: "FAQ not found" }, 404);
  }

  return c.json(faq);
});

// Delete FAQ
faqs.delete("/:id", async (c) => {
  const { id } = c.req.param();

  const existing = await prisma.fAQ.findUnique({
    where: { id },
  });

  if (!existing) {
    return c.json({ error: "FAQ not found" }, 404);
  }

  await prisma.fAQ.delete({
    where: { id },
  });

  return c.json({ success: true });
});

export { faqs };
