// Seed localizations for sets and cards from external API
import { env } from "@/env";
import { seedAllLocalizations } from "@/lib/db/seed-localizations";

async function run() {
  const dbHost = env.DATABASE_URL
    ? env.DATABASE_URL.split("@")[1]?.split("/")[0]?.split(":")[0]
    : "unknown host";
  const dbUser = env.DATABASE_URL
    ? env.DATABASE_URL.split("//")[1]?.split(":")[0]
    : "unknown user";

  if (dbHost !== "localhost") {
    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(
        `⚠️  WARNING: You are about to seed localizations to a non-local database\n${dbUser}@${dbHost}\nDo you want to proceed? (y/N): `,
        (answer) => {
          rl.close();
          resolve(answer);
        },
      );
    });

    if (answer.toLowerCase() !== "y") {
      console.log("❌  Seeding cancelled.");
      process.exit(0);
    }
  }

  console.log(
    "Starting to seed database with localizations from external API...",
  );

  await seedAllLocalizations();
  console.log("✅  Localization seeding completed!");
}

run().catch((err) => {
  console.error("❌  Fatal error:", err);
  process.exit(1);
});
