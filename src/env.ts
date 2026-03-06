import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { config } from "dotenv";

config();

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    DATABASE_URL: z.string().url(),
    AUTH_DISCORD_CLIENT_ID: z.string(),
    AUTH_DISCORD_CLIENT_SECRET: z.string(),
    AUTH_GOOGLE_CLIENT_ID: z.string(),
    AUTH_GOOGLE_CLIENT_SECRET: z.string(),
    CRON_SECRET: z.string(),
  },
  client: {
    // Base URL of the deployed app, used to build absolute proxy URLs.
    // Required for OG images, emails, or any server-side URL that must be
    // fully qualified.  Falls back to root-relative paths when not set.
    // Example: NEXT_PUBLIC_APP_URL=https://bulkratte.com
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  },
  // For Next.js >= 13.4.4, you only need to destructure client variables:
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
});
