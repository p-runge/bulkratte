import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { config } from "dotenv";

/**
 * When this env schema is being used outside of Next.js (e.g. in a separate script
 * within /scripts), the process.env variables won't be populated by Next.js, so we
 * need to load them manually using dotenv.
 */
if (typeof window === "undefined") {
  config();
}

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    DATABASE_URL: z.url(),
    AUTH_DISCORD_CLIENT_ID: z.string(),
    AUTH_DISCORD_CLIENT_SECRET: z.string(),
    AUTH_GOOGLE_CLIENT_ID: z.string(),
    AUTH_GOOGLE_CLIENT_SECRET: z.string(),
    CRON_SECRET: z.string(),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string(),
    R2_SECRET_ACCESS_KEY: z.string(),
    R2_BUCKET_NAME: z.string(),
    R2_ENDPOINT: z.url().optional(),
    // Core bucket — card images, set logos/symbols (served via /images/[...path])
    R2_CORE_BUCKET_NAME: z.string(),
    R2_CORE_ENDPOINT: z.url().optional(),
  },
  client: {
    NEXT_PUBLIC_RHF_SHOW_DEVTOOLS: z.string().optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_RHF_SHOW_DEVTOOLS: process.env.NEXT_PUBLIC_RHF_SHOW_DEVTOOLS,
  },
});
