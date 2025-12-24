import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./lib/auth";
import { prompts } from "./routes/prompts";
import { faqs } from "./routes/faqs";
import { channels } from "./routes/channels";
import { messages } from "./routes/messages";
import { users } from "./routes/users";
import { admins } from "./routes/admins";
import { roles } from "./routes/roles";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.API_CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Better Auth routes
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

// API routes
app.route("/api/prompts", prompts);
app.route("/api/faqs", faqs);
app.route("/api/channels", channels);
app.route("/api/messages", messages);
app.route("/api/users", users);
app.route("/api/admins", admins);
app.route("/api/roles", roles);

// 404 handler
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Error handler
app.onError((err, c) => {
  console.error("API Error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

export { app };

// Start server if running directly
const port = parseInt(process.env.API_PORT || "3001", 10);

export function startApiServer() {
  console.log(`API server starting on port ${port}...`);
  return Bun.serve({
    port,
    fetch: app.fetch,
  });
}

// Auto-start if this is the main module
if (import.meta.main) {
  startApiServer();
  console.log(`API server running at http://localhost:${port}`);
}
