// Fetch German card names from Pokewiki set articles (wikitext Setzeile format)
// and update still-missing.json entries that have null germanName.
// Also re-runs Pokewiki imageinfo lookup for those cards.
//
// Run: npx tsx scripts/patch-pokewiki-missing-names.ts

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

async function upsertLocalization(
  tableName: string,
  columnName: string,
  recordId: string,
  lang: string,
  value: string,
) {
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
    await db
      .insert(localizationsTable)
      .values({
        table_name: tableName,
        column_name: columnName,
        record_id: recordId,
        language: lang,
        value,
      });
  }
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Maps TCGdex setId → Pokewiki article title for sets that need name resolution
const SET_ARTICLE_TITLES: Record<string, string> = {
  g1: "Generationen (TCG)",
  dv1: "Drachengruft (TCG)",
  col1: "Ruf der Legenden (TCG)",
};

/**
 * Fetch the wikitext of a Pokewiki article and extract card number → German name
 * from {{Setzeile|{num}|{name}|...}} entries.
 */
async function fetchCardNames(
  articleTitle: string,
): Promise<Map<number, string>> {
  const params = new URLSearchParams({
    action: "parse",
    page: articleTitle,
    prop: "wikitext",
    format: "json",
  });
  const res = await fetch(`https://www.pokewiki.de/api.php?${params}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as any;
  const wikitext: string = data?.parse?.wikitext?.["*"] ?? "";

  const map = new Map<number, string>();
  // Match {{Setzeile|{num}|{name}|...}}
  for (const m of wikitext.matchAll(/\{\{Setzeile\|(\d+)\|([^|}\n]+)/g)) {
    if (!m[1] || !m[2]) continue;
    const num = parseInt(m[1], 10);
    const name = m[2].trim();
    if (!map.has(num)) map.set(num, name);
  }
  return map;
}

/**
 * Look up imageinfo for a list of file titles via Pokewiki API.
 */
async function lookupTitles(titles: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!titles.length) return result;

  const params = new URLSearchParams({
    action: "query",
    titles: titles.map((t) => `File:${t}`).join("|"),
    prop: "imageinfo",
    iiprop: "url",
    format: "json",
  });
  const res = await fetch(`https://www.pokewiki.de/api.php?${params}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as any;

  for (const page of Object.values(data?.query?.pages ?? {}) as any[]) {
    if (!page.imageinfo?.length) continue;
    const url: string = page.imageinfo[0].url;
    const titleRaw: string = page.title.replace(/^(File|Datei):/i, "");
    result.set(titleRaw.toLowerCase(), url);
  }
  return result;
}

async function main() {
  const missingPath = path.join(process.cwd(), "public", "still-missing.json");
  const allMissing = JSON.parse(fs.readFileSync(missingPath, "utf-8")) as any[];

  const resolvedIds = new Set<string>();
  const LANG = "de";
  let totalSeeded = 0;

  for (const [setId, articleTitle] of Object.entries(SET_ARTICLE_TITLES)) {
    const candidates = allMissing.filter((c) => c.setId === setId);
    if (!candidates.length) {
      console.log(`⏭  ${setId}: no missing cards`);
      continue;
    }

    process.stdout.write(
      `\n📖 ${setId} — fetching card names from "${articleTitle}" … `,
    );
    let nameMap: Map<number, string>;
    try {
      nameMap = await fetchCardNames(articleTitle);
      console.log(`${nameMap.size} names found`);
    } catch (err) {
      console.log(`❌ ${err}`);
      continue;
    }
    await sleep(400);

    // Fill in missing German names
    for (const card of candidates) {
      const num = parseInt(card.localId, 10);
      const name = nameMap.get(num);
      if (name && !card.germanName) {
        card.germanName = name;
      }
    }

    // Now look up images using the (now-filled) German names
    const BATCH = 25;
    const resolved = new Map<string, string>();
    for (let i = 0; i < candidates.length; i += BATCH) {
      const batch = candidates.slice(i, i + BATCH);
      const titleMap = new Map<string, string>();
      const titles: string[] = [];
      for (const card of batch) {
        if (!card.germanName) continue;
        const base = `${card.germanName} (${card.setName} ${card.localId})`;
        titles.push(`${base}.jpg`, `${base}.png`);
        titleMap.set(`${base}.jpg`.toLowerCase(), card.id);
        titleMap.set(`${base}.png`.toLowerCase(), card.id);
      }
      try {
        const found = await lookupTitles(titles);
        for (const [lc, url] of found) {
          const cardId = titleMap.get(lc);
          if (cardId && !resolved.has(cardId)) resolved.set(cardId, url);
        }
      } catch (err) {
        console.error(`\n  ❌ batch error: ${err}`);
      }
      if (i + BATCH < candidates.length) await sleep(350);
    }

    // Seed resolved images + names
    let seeded = 0;
    for (const card of candidates) {
      const url = resolved.get(card.id);
      if (!url) continue;
      try {
        await upsertLocalization("cards", "image_small", card.id, LANG, url);
        await upsertLocalization("cards", "image_large", card.id, LANG, url);
        if (card.germanName) {
          await upsertLocalization(
            "cards",
            "name",
            card.id,
            LANG,
            card.germanName,
          );
        }
        resolvedIds.add(card.id);
        seeded++;
        totalSeeded++;
      } catch (err) {
        console.error(`  ❌ ${card.id}: ${err}`);
      }
    }

    const icon = seeded === candidates.length ? "✅" : seeded > 0 ? "🟡" : "⚠️";
    console.log(
      `  ${icon} ${setId}: ${seeded}/${candidates.length} images seeded`,
    );
  }

  // Update still-missing.json: remove seeded cards
  const remaining = allMissing.filter((c) => !resolvedIds.has(c.id));
  fs.writeFileSync(missingPath, JSON.stringify(remaining, null, 2) + "\n");

  console.log(`\n========= DONE =========`);
  console.log(`✅ Seeded:    ${totalSeeded} cards`);
  console.log(
    `⏳ Remaining: ${remaining.length} cards in still-missing.json\n`,
  );
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
