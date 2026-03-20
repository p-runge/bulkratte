/**
 * sync-basep-de.ts
 *
 * Syncs the German localizations for the Wizards Black Star Promo set (basep)
 * against the authoritative list from:
 * https://pokezentrum.de/blog/alle-wizards-black-star-promo-pokemon-karten-in-der-ubersicht/
 *
 * Of the 53 cards, exactly 24 were released in German.
 * All other cards get their DE localizations deleted → frontend falls back to English.
 *
 * Run: npx tsx --tsconfig tsconfig.scripts.json scripts/sync-basep-de.ts
 * Dry run: DRY_RUN=1 npx tsx --tsconfig tsconfig.scripts.json scripts/sync-basep-de.ts
 */

import "dotenv/config";
import { Client } from "pg";

const DRY_RUN = process.env.DRY_RUN === "1";

// The 24 officially German Wizards Black Star Promo cards.
// Source: https://pokezentrum.de/blog/alle-wizards-black-star-promo-pokemon-karten-in-der-ubersicht/
// Image and name are from that page; both image_small and image_large use the same .jpg
// (pokezentrum only provides one resolution).
const GERMAN_CARDS: Record<string, { name: string; image: string }> = {
  "1":  { name: "Pikachu",             image: "https://pokezentrum.de/wp-content/uploads/Pikachu-1-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
  "2":  { name: "Elektek",             image: "https://pokezentrum.de/wp-content/uploads/Elektek-2-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
  "3":  { name: "Mewtu",               image: "https://pokezentrum.de/wp-content/uploads/Mewtu-3-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
  "4":  { name: "Pikachu",             image: "https://pokezentrum.de/wp-content/uploads/Pikachu-4-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
  "5":  { name: "Dragonit",            image: "https://pokezentrum.de/wp-content/uploads/Dragonit-Dragoran-5-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch.jpg" },
  "6":  { name: "Arkani",              image: "https://pokezentrum.de/wp-content/uploads/Arkani-6-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
  "9":  { name: "Mew",                 image: "https://pokezentrum.de/wp-content/uploads/Mew-9-Wizards-Black-Star-Promo-Holo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
  "14": { name: "Mewtu",               image: "https://pokezentrum.de/wp-content/uploads/Mewtu-14-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
  "21": { name: "Lavados",             image: "https://pokezentrum.de/wp-content/uploads/Lavados-21-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
  "22": { name: "Arktos",              image: "https://pokezentrum.de/wp-content/uploads/Arktos-22-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
  "23": { name: "Zapdos",              image: "https://pokezentrum.de/wp-content/uploads/Zapdos-23-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
  "24": { name: "Geburtstags-Pikachu", image: "https://pokezentrum.de/wp-content/uploads/Geburtstags-Birthday-Pikachu-24-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
  "25": { name: "Fliegendes Pikachu",  image: "https://pokezentrum.de/wp-content/uploads/Fliegendes-Pikachu-25-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
  "26": { name: "Pikachu",             image: "https://pokezentrum.de/wp-content/uploads/Pikachu-26-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
  "29": { name: "Marill",              image: "https://pokezentrum.de/wp-content/uploads/Marill-29-Wizards-Black-Star-Promo-Pokemon-Karte-Englisch-TCG-Sammelkartenspiel.jpg" },
  "30": { name: "Togepi",              image: "https://pokezentrum.de/wp-content/uploads/Togepi-30-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
  "31": { name: "Pii",                 image: "https://pokezentrum.de/wp-content/uploads/Pii-31-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
  "32": { name: "Farbeagle",           image: "https://pokezentrum.de/wp-content/uploads/Farbeagle-32-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
  "33": { name: "Scherox",             image: "https://pokezentrum.de/wp-content/uploads/Scherox-33-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
  "35": { name: "Pichu",               image: "https://pokezentrum.de/wp-content/uploads/Pichu-35-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
  "36": { name: "Fluffeluff",          image: "https://pokezentrum.de/wp-content/uploads/Fluffeluff-36-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
  "37": { name: "Kapoera",             image: "https://pokezentrum.de/wp-content/uploads/Kapoera-37-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
  "38": { name: "Icognito J",          image: "https://pokezentrum.de/wp-content/uploads/Icognito-J-38-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
  "39": { name: "Traunfugil",          image: "https://pokezentrum.de/wp-content/uploads/Traunfugil-39-Wizards-Black-Star-Promo-Pokemon-Karte-Deutsch-TCG-Sammelkartenspiel.jpg" },
};

async function upsert(
  db: Client,
  cardId: string,
  column: string,
  value: string
) {
  if (DRY_RUN) return;
  // Delete existing then insert — no UNIQUE constraint on localizations table
  await db.query(
    `DELETE FROM localizations
     WHERE table_name = 'cards' AND column_name = $1 AND record_id = $2 AND language = 'de'`,
    [column, cardId]
  );
  await db.query(
    `INSERT INTO localizations (id, table_name, column_name, record_id, language, value)
     VALUES (gen_random_uuid(), 'cards', $1, $2, 'de', $3)`,
    [column, cardId, value]
  );
}

async function main() {
  if (DRY_RUN) console.log("⚠️  DRY RUN — no changes will be written\n");

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error(
      "DATABASE_URL is not set. Please configure it in your environment or .env file before running this script."
    );
    process.exit(1);
  }

  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();

  try {
    // Fetch all basep cards from the DB
    const cardsRes = await db.query<{
      id: string;
      number: string;
      name: string;
      de_name: string | null;
      de_img_small: string | null;
      de_img_large: string | null;
    }>(`
      SELECT
        c.id,
        c.number,
        c.name,
        MAX(CASE WHEN l.column_name = 'name'        THEN l.value END) AS de_name,
        MAX(CASE WHEN l.column_name = 'image_small' THEN l.value END) AS de_img_small,
        MAX(CASE WHEN l.column_name = 'image_large' THEN l.value END) AS de_img_large
      FROM cards c
      LEFT JOIN localizations l
        ON l.record_id = c.id AND l.language = 'de' AND l.table_name = 'cards'
      WHERE c.set_id = 'basep'
      GROUP BY c.id, c.number, c.name
      ORDER BY c.number::int NULLS LAST
    `);

    let deleted = 0;
    let upserted = 0;
    let skipped = 0;

    for (const card of cardsRes.rows) {
      const german = GERMAN_CARDS[card.number];

      if (!german) {
        // Not a German card — delete any existing DE locs
        const countRes = await db.query<{ cnt: string }>(
          `SELECT COUNT(*)::text AS cnt FROM localizations
           WHERE table_name = 'cards' AND record_id = $1 AND language = 'de'`,
          [card.id]
        );
        const n = parseInt(countRes.rows[0].cnt);
        if (n > 0) {
          console.log(`🗑  #${card.number.padEnd(3)} ${card.name.padEnd(30)} — ${DRY_RUN ? "would delete" : "deleted"} ${n} DE rows (EN-only card)`);
          deleted += n;
          if (!DRY_RUN) {
            await db.query(
              `DELETE FROM localizations
               WHERE table_name = 'cards' AND record_id = $1 AND language = 'de'`,
              [card.id]
            );
          }
        } else {
          skipped++;
        }
      } else {
        // German card — ensure name + images are correctly set
        const needsName  = card.de_name !== german.name;
        const needsSmall = card.de_img_small !== german.image;
        const needsLarge = card.de_img_large !== german.image;

        if (needsName || needsSmall || needsLarge) {
          const changes: string[] = [];
          if (needsName)  changes.push(`name="${german.name}"`);
          if (needsSmall) changes.push(`image_small`);
          if (needsLarge) changes.push(`image_large`);
          console.log(`✏️  #${card.number.padEnd(3)} ${german.name.padEnd(30)} — updating: ${changes.join(", ")}`);

          if (needsName)  await upsert(db, card.id, "name",        german.name);
          if (needsSmall) await upsert(db, card.id, "image_small", german.image);
          if (needsLarge) await upsert(db, card.id, "image_large", german.image);
          upserted++;
        } else {
          console.log(`✓  #${card.number.padEnd(3)} ${german.name.padEnd(30)} — already correct`);
          skipped++;
        }
      }
    }

    console.log(`\n${"─".repeat(60)}`);
    console.log(`Rows deleted (EN-only cards):  ${deleted}`);
    console.log(`Cards updated (DE data fixed): ${upserted}`);
    console.log(`Cards unchanged:               ${skipped}`);
    if (DRY_RUN) console.log("\n(DRY RUN — nothing was written)");
    else console.log("\n✅  basep DE localizations are now in sync with pokezentrum.de");
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
