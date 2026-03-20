// seed-german-names.ts
// For the 7 truly unresolvable cards: seed German names only (no images).
// The image will fall back to the English card image in the UI.
//
// Run: npx tsx --tsconfig tsconfig.scripts.json scripts/seed-german-names.ts

import { config } from "dotenv";
config();

import * as fs from "fs";
import * as path from "path";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, sql } from "drizzle-orm";
import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}
const db = drizzle(DATABASE_URL);

const localizationsTable = pgTable("localizations", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  table_name: varchar("table_name", { length: 64 }).notNull(),
  column_name: varchar("column_name", { length: 64 }).notNull(),
  record_id: varchar("record_id", { length: 16 }).notNull(),
  language: varchar("language", { length: 8 }).notNull(),
  value: text("value").notNull(),
  created_at: timestamp("created_at", { mode: "string" })
    .notNull()
    .defaultNow(),
  updated_at: timestamp("updated_at", { mode: "string" })
    .notNull()
    .defaultNow(),
});

async function upsertName(recordId: string, value: string): Promise<void> {
  const existing = await db
    .select()
    .from(localizationsTable)
    .where(
      and(
        eq(localizationsTable.table_name, "cards"),
        eq(localizationsTable.column_name, "name"),
        eq(localizationsTable.record_id, recordId),
        eq(localizationsTable.language, "de"),
      ),
    )
    .limit(1);
  if (existing[0]) {
    await db
      .update(localizationsTable)
      .set({ value, updated_at: sql`NOW()` })
      .where(eq(localizationsTable.id, existing[0].id));
  } else {
    await db.insert(localizationsTable).values({
      table_name: "cards",
      column_name: "name",
      record_id: recordId,
      language: "de",
      value,
    });
  }
}

async function run() {
  const MISSING_FILE = path.join(__dirname, "../public/still-missing.json");
  const missing = JSON.parse(fs.readFileSync(MISSING_FILE, "utf8")) as any[];

  let seeded = 0;
  const cleared: string[] = [];

  for (const card of missing) {
    // Seed German name if available
    if (card.germanName && !card.germanName.endsWith("*")) {
      await upsertName(card.id, card.germanName);
      console.log(
        `📝 ${card.id}: name="${card.germanName}" (no German image available)`,
      );
      seeded++;
    } else if (card.germanName) {
      // Strip asterisk for names like "EXP.ALL*"
      const cleanName = card.germanName.replace(/\*$/, "");
      await upsertName(card.id, cleanName);
      console.log(
        `📝 ${card.id}: name="${cleanName}" (asterisk stripped, no image)`,
      );
      seeded++;
    } else {
      console.log(`⚠️  ${card.id}: no German name available`);
    }
    cleared.push(card.id);
  }

  // Empty the still-missing.json - these are best-effort complete
  fs.writeFileSync(MISSING_FILE, JSON.stringify([], null, 2));

  console.log(`\n📝 German names seeded: ${seeded}`);
  console.log(
    `🏁 still-missing.json cleared (${cleared.length} cards accepted as best-effort)`,
  );
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
