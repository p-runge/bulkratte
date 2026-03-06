// seed-from-holo.ts
// For sets with holo + non-holo prints of the same Pokemon, copy the German
// image URL and name from the seeded holo card to the missing non-holo card.
//
// This works because:
//   - Pokewiki names images after the holo version's card number
//   - e.g. "Simsala (Expedition 1).jpg" is the image for BOTH ecard1-1 (holo)
//     and ecard1-33 (non-holo)
//   - Same pattern applies to base2 (1-16 holos, 17-32 non-holos),
//     base3 (1-15 holos, 16-30 non-holos), base5 (1-16 holos, 17-32 non-holos),
//     neo1, neo2 etc.
//
// Run: npx tsx --tsconfig tsconfig.scripts.json scripts/seed-from-holo.ts

import { config } from "dotenv";
config();

import * as fs from "fs";
import * as path from "path";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, sql, ne } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// DB setup (standalone, same as other seed scripts)
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not set in .env");
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getLocalization(
  recordId: string,
  columnName: string,
  lang = "de",
): Promise<string | null> {
  const rows = await db
    .select()
    .from(localizationsTable)
    .where(
      and(
        eq(localizationsTable.table_name, "cards"),
        eq(localizationsTable.column_name, columnName),
        eq(localizationsTable.record_id, recordId),
        eq(localizationsTable.language, lang),
      ),
    )
    .limit(1);
  return rows[0]?.value ?? null;
}

async function upsertLocalization(
  recordId: string,
  columnName: string,
  value: string,
  lang = "de",
): Promise<void> {
  const existing = await db
    .select()
    .from(localizationsTable)
    .where(
      and(
        eq(localizationsTable.table_name, "cards"),
        eq(localizationsTable.column_name, columnName),
        eq(localizationsTable.record_id, recordId),
        eq(localizationsTable.language, lang),
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
      column_name: columnName,
      record_id: recordId,
      language: lang,
      value,
    });
  }
}

// ---------------------------------------------------------------------------
// Main logic: find a seeded sibling card (same name, same set)
// and copy its German localizations.
// ---------------------------------------------------------------------------

interface MissingCard {
  id: string;
  name?: string;
  setName?: string;
}

async function findSeededSibling(
  cardId: string,
): Promise<{ name: string; imageSmall: string; imageLarge: string } | null> {
  // Query: find another card in the same set with the same English name
  // that has a German image_large localization.
  const rows = (
    await db.execute(sql`
    SELECT c2.id AS sibling_id, l_name.value AS de_name,
           l_small.value AS de_small, l_large.value AS de_large
    FROM cards c
    JOIN cards c2 ON c2.set_id = c.set_id
                  AND c2.name = c.name
                  AND c2.id <> c.id
    JOIN localizations l_large ON l_large.table_name = 'cards'
                               AND l_large.column_name = 'image_large'
                               AND l_large.record_id = c2.id
                               AND l_large.language = 'de'
    LEFT JOIN localizations l_small ON l_small.table_name = 'cards'
                                    AND l_small.column_name = 'image_small'
                                    AND l_small.record_id = c2.id
                                    AND l_small.language = 'de'
    LEFT JOIN localizations l_name ON l_name.table_name = 'cards'
                                   AND l_name.column_name = 'name'
                                   AND l_name.record_id = c2.id
                                   AND l_name.language = 'de'
    WHERE c.id = ${cardId}
    LIMIT 1
  `)
  ).rows as any[];

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    name: row.de_name ?? null,
    imageSmall: row.de_small ?? row.de_large,
    imageLarge: row.de_large,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function run() {
  const MISSING_FILE = path.resolve(__dirname, "../public/still-missing.json");
  let missing: MissingCard[] = JSON.parse(
    fs.readFileSync(MISSING_FILE, "utf8"),
  ) as MissingCard[];

  console.log(`📋 Starting with ${missing.length} missing cards\n`);

  const remaining: MissingCard[] = [];
  let seeded = 0;

  for (const card of missing) {
    const sibling = await findSeededSibling(card.id);

    if (!sibling) {
      remaining.push(card);
      continue;
    }

    // Copy image_small, image_large (and name if available)
    await upsertLocalization(card.id, "image_small", sibling.imageSmall);
    await upsertLocalization(card.id, "image_large", sibling.imageLarge);
    if (sibling.name) {
      await upsertLocalization(card.id, "name", sibling.name);
    }

    console.log(
      `✅ ${card.id}: seeded from sibling → ${sibling.imageLarge.slice(0, 80)}`,
    );
    seeded++;
  }

  // Persist updated missing list
  fs.writeFileSync(MISSING_FILE, JSON.stringify(remaining, null, 2));

  console.log(`\n✅ Seeded: ${seeded} cards`);
  console.log(`📋 Still missing: ${remaining.length} cards`);
  console.log(`💾 Updated ${MISSING_FILE}`);
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
