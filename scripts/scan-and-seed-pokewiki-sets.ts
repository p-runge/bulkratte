// Scan Pokewiki for German card images using per-card title lookup.
//
// Pokewiki image naming convention:
//   {GermanName} ({SetName} {localId}).jpg   (or .png)
// e.g.: "Glurak (Grundset 4).png"
//       "Tornupto (Neo Genesis 18).jpg"
//
// The setName from still-missing.json already matches the Pokewiki label for
// all confirmed sets. POKEWIKI_SETS lists the set IDs known to have Pokewiki
// coverage; cards from other sets are skipped.
//
// For each batch of 25 cards the script sends one MediaWiki API request that
// checks both .jpg and .png variants (50 titles per request).
//
// Run: npx tsx scripts/scan-and-seed-pokewiki-sets.ts

import { config } from "dotenv";
config();

import * as fs from "fs";
import * as path from "path";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, sql } from "drizzle-orm";
import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// DB setup
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

// ---------------------------------------------------------------------------
// Sets confirmed to have Pokewiki image coverage
// (setName in still-missing.json == Pokewiki label for all of these)
// ---------------------------------------------------------------------------

const POKEWIKI_SETS = new Set([
  // Vintage (already mostly seeded — residual missing cards)
  "base1",
  "base2",
  "base3",
  // Team Rocket
  "base5",
  // Neo (all 4 confirmed on Pokewiki)
  "neo1",
  "neo2",
  "neo3",
  "neo4",
  // e-Card era
  "ecard1",
  "ecard2",
  "ecard3",
  // EX era (all confirmed on Pokewiki)
  "ex1",
  "ex2",
  "ex3",
  "ex4",
  "ex6",
  "ex8",
  "ex9",
  "ex10",
  "ex11",
  "ex12",
  "ex13",
  "ex14",
  "ex15",
  "ex16",
  // DP era (all confirmed)
  "dp1",
  "dp2",
  "dp3",
  "dp4",
  "dp5",
  "dp6",
  "dp7",
  // DP promos
  "dpp",
  // Platinum era
  "pl1",
  "pl2",
  "pl3",
  "pl4",
  // HGSS era
  "hgss1",
  "hgss2",
  "hgss3",
  "hgss4",
  // HGSS promos
  "hgssp",
  // BW / misc
  "col1",
  "g1",
  "dv1",
  // Promo sets (may have partial coverage)
  "smp",
  "swshp",
  "svp",
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MissingCard {
  setId: string;
  setName: string;
  id: string;
  localId: string;
  englishName: string;
  germanName: string | null;
  hasGermanImage: boolean;
  germanImageUrl: string | null;
  pokewikiFilename: string | null;
  pokewikiUrl: string | null;
  status: string;
}

// ---------------------------------------------------------------------------
// Pokewiki API helpers
// ---------------------------------------------------------------------------

const POKEWIKI_API = "https://www.pokewiki.de/api.php";
const BATCH_SIZE = 25; // cards per request (×2 extensions = 50 titles/request)

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Construct the expected Pokewiki file base title for a card (without extension).
 * Format: "{GermanName} ({SetName} {localId})"
 */
function fileBase(card: MissingCard): string {
  const name = (card.germanName ?? card.englishName).trim();
  return `${name} (${card.setName} ${card.localId})`;
}

/**
 * Look up a batch of file titles in the MediaWiki API.
 * Returns a map: normalised lowercase filename → direct image URL.
 */
async function lookupTitles(titles: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (titles.length === 0) return result;

  const params = new URLSearchParams({
    action: "query",
    titles: titles.map((t) => `File:${t}`).join("|"),
    prop: "imageinfo",
    iiprop: "url",
    format: "json",
  });

  const res = await fetch(`${POKEWIKI_API}?${params.toString()}`, {
    headers: {
      // Pokewiki blocks non-browser User-Agent strings (returns 403 otherwise)
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Pokewiki API HTTP ${res.status}`);
  }

  const data = (await res.json()) as any;
  const pages: Record<string, any> = data?.query?.pages ?? {};

  for (const page of Object.values(pages)) {
    if (!page.imageinfo || page.imageinfo.length === 0) continue;
    const url: string = page.imageinfo[0].url;
    if (!url) continue;
    const titleRaw: string = (page.title as string).replace(
      /^(File|Datei):/i,
      "",
    );
    result.set(titleRaw.toLowerCase(), url);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // DB safety check
  const dbHost =
    DATABASE_URL!.split("@")[1]?.split("/")[0]?.split(":")[0] ?? "unknown";
  const dbUser = DATABASE_URL!.split("//")[1]?.split(":")?.[0] ?? "unknown";

  if (dbHost !== "localhost") {
    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await new Promise<string>((resolve) => {
      rl.question(
        `⚠️  Non-local database: ${dbUser}@${dbHost}\nProceed? (y/N): `,
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

  // Load still-missing.json
  const missingPath = path.join(process.cwd(), "public", "still-missing.json");
  const allMissing: MissingCard[] = JSON.parse(
    fs.readFileSync(missingPath, "utf-8"),
  ) as MissingCard[];

  // Filter to only sets with Pokewiki coverage
  const candidates = allMissing.filter((c) => POKEWIKI_SETS.has(c.setId));
  const skipped = allMissing.length - candidates.length;
  const setCount = new Set(candidates.map((c) => c.setId)).size;

  console.log(`\n🔍 Pokewiki title-lookup scan`);
  console.log(
    `   ${candidates.length} candidate cards across ${setCount} sets` +
      ` (${skipped} skipped — not on Pokewiki)\n`,
  );

  // Phase 1: look up images in batches
  const resolvedUrls = new Map<string, string>(); // cardId → imageUrl

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);

    const titleToCardId = new Map<string, string>();
    const allTitles: string[] = [];

    for (const card of batch) {
      const base = fileBase(card);
      const jpg = `${base}.jpg`;
      const png = `${base}.png`;
      allTitles.push(jpg, png);
      titleToCardId.set(jpg.toLowerCase(), card.id);
      titleToCardId.set(png.toLowerCase(), card.id);
    }

    let found: Map<string, string>;
    try {
      found = await lookupTitles(allTitles);
    } catch (err) {
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(candidates.length / BATCH_SIZE);
      // \n first so the error doesn't get overwritten by the \r progress line
      console.error(`\n  ❌ Batch ${batchNum}/${totalBatches} failed: ${err}`);
      await sleep(2000);
      continue;
    }

    for (const [lcTitle, imageUrl] of found) {
      const cardId = titleToCardId.get(lcTitle);
      if (!cardId || resolvedUrls.has(cardId)) continue;
      resolvedUrls.set(cardId, imageUrl);
    }

    process.stdout.write(
      `\r  🔎 Scanned ${Math.min(i + BATCH_SIZE, candidates.length)}/${candidates.length} cards — ${resolvedUrls.size} found`,
    );

    if (i + BATCH_SIZE < candidates.length) await sleep(350);
  }

  console.log(); // newline after progress

  // Phase 2: seed to DB, grouped by set for readable output
  console.log(`\n💾 Seeding ${resolvedUrls.size} resolved cards...\n`);

  const resolvedIds = new Set<string>();
  let totalSeeded = 0;
  let totalErrors = 0;
  const LANG = "de";

  const bySet = new Map<string, { card: MissingCard; url: string }[]>();
  for (const card of candidates) {
    const url = resolvedUrls.get(card.id);
    if (!url) continue;
    if (!bySet.has(card.setId)) bySet.set(card.setId, []);
    bySet.get(card.setId)!.push({ card, url });
  }

  for (const [setId, entries] of bySet) {
    const setMissing = candidates.filter((c) => c.setId === setId).length;
    let setSeeded = 0;

    for (const { card, url } of entries) {
      try {
        await upsertLocalization("cards", "image_small", card.id, LANG, url);
        await upsertLocalization("cards", "image_large", card.id, LANG, url);
        resolvedIds.add(card.id);
        setSeeded++;
        totalSeeded++;
      } catch (err) {
        console.error(`  ❌ ${card.id}: ${err}`);
        totalErrors++;
      }
    }

    const icon = setSeeded === setMissing ? "✅" : setSeeded > 0 ? "🟡" : "❌";
    console.log(`  ${icon} ${setId.padEnd(8)} ${setSeeded}/${setMissing}`);
  }

  // Report sets with 0 matches
  for (const setId of POKEWIKI_SETS) {
    const hasMissing = candidates.some((c) => c.setId === setId);
    const hasResolved = [...resolvedIds].some((id) =>
      id.startsWith(`${setId}-`),
    );
    if (hasMissing && !hasResolved) {
      const count = candidates.filter((c) => c.setId === setId).length;
      console.log(
        `  ⚠️  ${setId.padEnd(8)} 0/${count} — no Pokewiki images found`,
      );
    }
  }

  // Phase 3: update still-missing.json
  const remaining = allMissing.filter((c) => !resolvedIds.has(c.id));
  fs.writeFileSync(missingPath, JSON.stringify(remaining, null, 2) + "\n");

  console.log(`\n========= DONE =========`);
  console.log(`✅ Seeded:    ${totalSeeded} cards`);
  if (totalErrors > 0) console.log(`❌ Errors:    ${totalErrors}`);
  console.log(`⏳ Remaining: ${remaining.length} cards in still-missing.json`);
  console.log();
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
