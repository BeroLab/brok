import { Hono } from "hono";
import { adminOnly } from "../middleware/admin-only";
import { rest, guildId } from "../lib/discord";
import { Routes, type APIRole } from "discord-api-types/v10";

const roles = new Hono();

roles.use("*", adminOnly);

// List all guild roles
roles.get("/", async (c) => {
  const allRoles = (await rest.get(Routes.guildRoles(guildId))) as APIRole[];

  // Filter out @everyone and managed roles (bots), sort by position descending
  const filteredRoles = allRoles
    .filter((role) => role.name !== "@everyone" && !role.managed)
    .sort((a, b) => b.position - a.position)
    .map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      position: role.position,
    }));

  return c.json(filteredRoles);
});

export { roles };
