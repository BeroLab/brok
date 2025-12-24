import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { db } from "./mongodb";

export const auth = betterAuth({
  database: mongodbAdapter(db),
  baseURL: process.env.API_BASE_URL || "http://localhost:3001",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    process.env.API_CORS_ORIGIN || "http://localhost:3000",
  ],
  socialProviders: {
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 min cache
    },
  },
});

export type Session = typeof auth.$Infer.Session;
