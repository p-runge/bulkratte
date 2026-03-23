// Seed German card image localizations for the Wizards Black Star Promo set (basep)
// using card scans sourced from pokezentrum.de.
//
// Source: https://pokezentrum.de/blog/alle-wizards-black-star-promo-pokemon-karten-in-der-ubersicht/
//
// 24 of the 53 basep cards were released in German. English-only promos are skipped.
// Images are proxied through /api/image at read time (see applyImageProxy
// in src/lib/db/localization.ts).

import { config } from "dotenv";
config();

import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, sql } from "drizzle-orm";
import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set in .env");
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

async function upsertLocalization(
  tableName: string,
  columnName: string,
  recordId: string,
  lang: string,
  value: string,
): Promise<void> {
  const existing = await db
    .select()
    .from(localizationsTable)
    .where(
      and(
        eq(localizationsTable.table_name, tableName),
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
      table_name: tableName,
      column_name: columnName,
      record_id: recordId,
      language: lang,
      value,
    });
  }
}

// [localId, germanName, imageUrl]
// Only cards with "Sprache: Deutsch" from the pokezentrum.de article.
// Cards #7, 8, 10-13, 15-20, 27, 28, 34, 40-47, 49, 51-53 are English-only.
const CARDS: [string, string, string][] = [
  [
    "1",
    "Pikachu",
    "https://pokezentrum.de/wp-content/uploads/Pikachu-1-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "2",
    "Elektek",
    "https://pokezentrum.de/wp-content/uploads/Elektek-2-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "3",
    "Mewtu",
    "https://pokezentrum.de/wp-content/uploads/Mewtu-3-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "4",
    "Pikachu",
    "https://pokezentrum.de/wp-content/uploads/Pikachu-4-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "5",
    "Dragonit",
    "https://pokezentrum.de/wp-content/uploads/Dragonit-Dragoran-5-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch.jpg",
  ],
  [
    "6",
    "Arkani",
    "https://pokezentrum.de/wp-content/uploads/Arkani-6-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "9",
    "Mew",
    "https://pokezentrum.de/wp-content/uploads/Mew-9-Wizards-Black-Star-Promo-Holo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "14",
    "Mewtu",
    "https://pokezentrum.de/wp-content/uploads/Mewtu-14-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "21",
    "Lavados",
    "https://pokezentrum.de/wp-content/uploads/Lavados-21-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "22",
    "Arktos",
    "https://pokezentrum.de/wp-content/uploads/Arktos-22-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "23",
    "Zapdos",
    "https://pokezentrum.de/wp-content/uploads/Zapdos-23-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "24",
    "Geburtstags-Pikachu",
    "https://pokezentrum.de/wp-content/uploads/Geburtstags-Birthday-Pikachu-24-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "25",
    "Fliegendes Pikachu",
    "https://pokezentrum.de/wp-content/uploads/Fliegendes-Pikachu-25-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "26",
    "Pikachu",
    "https://pokezentrum.de/wp-content/uploads/Pikachu-26-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "29",
    "Marill",
    "https://pokezentrum.de/wp-content/uploads/Marill-29-Wizards-Black-Star-Promo-Pokemon-Karte-Englisch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "30",
    "Togepi",
    "https://pokezentrum.de/wp-content/uploads/Togepi-30-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "31",
    "Pii",
    "https://pokezentrum.de/wp-content/uploads/Pii-31-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "32",
    "Farbeagle",
    "https://pokezentrum.de/wp-content/uploads/Farbeagle-32-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "33",
    "Scherox",
    "https://pokezentrum.de/wp-content/uploads/Scherox-33-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "35",
    "Pichu",
    "https://pokezentrum.de/wp-content/uploads/Pichu-35-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "36",
    "Fluffeluff",
    "https://pokezentrum.de/wp-content/uploads/Fluffeluff-36-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "37",
    "Kapoera",
    "https://pokezentrum.de/wp-content/uploads/Kapoera-37-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "38",
    "Icognito J",
    "https://pokezentrum.de/wp-content/uploads/Icognito-J-38-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "39",
    "Traunfugil",
    "https://pokezentrum.de/wp-content/uploads/Traunfugil-39-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "48",
    "Arktos",
    "https://pokezentrum.de/wp-content/uploads/Arktos-48-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
  [
    "50",
    "Celebi",
    "https://pokezentrum.de/wp-content/uploads/Celebi-50-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg",
  ],
];

const LANG = "de";
const SET_ID = "basep";

async function run() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  const dbHost = dbUrl.split("@")[1]?.split("/")[0]?.split(":")[0] ?? "unknown";
  const dbUser = dbUrl.split("//")[1]?.split(":")?.[0] ?? "unknown";

  if (dbHost !== "localhost") {
    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await new Promise<string>((resolve) => {
      rl.question(
        `⚠️  WARNING: Non-local database: ${dbUser}@${dbHost}\nProceed? (y/N): `,
        (a) => {
          rl.close();
          resolve(a);
        },
      );
    });
    if (answer.toLowerCase() !== "y") {
      console.log("❌ Cancelled.");
      process.exit(0);
    }
  }

  console.log(
    `\n🌱 Seeding ${CARDS.length} German Wizards Black Star Promo cards...\n`,
  );

  let seeded = 0;
  let errors = 0;

  for (const [localId, germanName, imageUrl] of CARDS) {
    const cardId = `${SET_ID}-${localId}`;
    try {
      await upsertLocalization("cards", "image_small", cardId, LANG, imageUrl);
      await upsertLocalization("cards", "image_large", cardId, LANG, imageUrl);
      await upsertLocalization("cards", "name", cardId, LANG, germanName);
      console.log(`  ✅ ${cardId.padEnd(12)} ${germanName}`);
      seeded++;
    } catch (err) {
      console.error(`  ❌ ${cardId}: ${err}`);
      errors++;
    }
  }

  console.log(`\n========= SEED COMPLETE =========`);
  console.log(`✅ Seeded:  ${seeded} cards`);
  if (errors > 0) console.log(`❌ Errors:  ${errors}`);
}

run().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
