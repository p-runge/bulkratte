// seed-remaining-names-and-images.ts
// For the 25 remaining cards without German data:
//  1. Fetch German name from TCGDex DE API (if available)
//  2. Fall back to hardcoded known translations for unresolvable cards
//  3. Seed confirmed S3 images for gym2-75/76 (identified via sequential analysis)
//  4. Update still-missing.json
//
// Run: npx tsx --tsconfig tsconfig.scripts.json scripts/seed-remaining-names-and-images.ts

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { db, localizationsTable } from "../src/lib/db/index";
import { eq, and, sql } from "drizzle-orm";

const S3_BASE = "https://product-images.s3.cardmarket.com/51";
const REFERER = "https://www.cardmarket.com/";
const STILL_MISSING_PATH = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../public/still-missing.json",
);

// Language code used by the DB (NOT de-DE!)
const LANG = "de";

// Hardcoded German names for cards not available via TCGDex DE API.
// Sources: pokewiki.de (German Pokémon wiki), personal knowledge of localized names.
// Cards already in DB (neo4-93, ecard1-147, dp5-83, smp-SM*, sm7.5-61) are skipped
// because they already have German names from a previous seeding session.
const KNOWN_GERMAN_NAMES: Record<string, string> = {
  // Wizards Black Star Promos
  "basep-15": "Cooles Porygon",
  "basep-16": "Computerfehler",
  "basep-19": "Sabrinas Abra",
  "basep-42": "Pokémonturm",
  // Gym Challenge
  "gym2-75": "Giovannis Nidoran ♀",
  "gym2-76": "Giovannis Nidoran ♂",
  // HGSS Black Star Promos
  "hgssp-HGSS18": "Tropische Flutwelle",
  // XY Black Star Promos
  "xyp-XY150a": "Yveltal-EX",
  // Legendary Treasures
  "bw11-77": "Skelabra-EX",
  "bw11-82": "Stalobor-EX",
  "bw11-RC11": "Meloetta-EX",
  "bw11-RC25": "Meloetta-EX",
  // Crimson Invasion
  "sm4-63a": "Olgottod-GX",
  // SVP Black Star Promos
  "svp-085": "Pikachu mit grauem Filzhut",
  "svp-500": "Terapagos und Freunde",
};

// Confirmed S3 image mappings derived from sequential analysis:
// gym2 range 274269-274400, cards 73→274341 and 77→274345,
// so gaps 274342 and 274343 are immediately before gym2-77 = gym2-75 and gym2-76.
// All three gap idProducts (274342-274344) confirmed to exist on S3 via HEAD.
const CONFIRMED_IMAGES: Array<{
  id: string;
  cmCode: string;
  idProduct: number;
}> = [
  { id: "gym2-75", cmCode: "GC", idProduct: 274342 },
  { id: "gym2-76", cmCode: "GC", idProduct: 274343 },
];

async function imageExists(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, {
      method: "HEAD",
      headers: { Referer: REFERER, "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function upsert(
  recordId: string,
  col: string,
  value: string,
): Promise<void> {
  const existing = await db
    .select({ id: localizationsTable.id })
    .from(localizationsTable)
    .where(
      and(
        eq(localizationsTable.table_name, "cards"),
        eq(localizationsTable.column_name, col),
        eq(localizationsTable.record_id, recordId),
        eq(localizationsTable.language, LANG),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(localizationsTable)
      .set({ value, updated_at: sql`NOW()` })
      .where(eq(localizationsTable.id, existing[0]!.id));
  } else {
    await db.insert(localizationsTable).values({
      table_name: "cards",
      column_name: col,
      record_id: recordId,
      language: LANG,
      value,
    });
  }
}

async function tryTcgdexDeName(cardId: string): Promise<string | null> {
  try {
    const url = `https://api.tcgdex.net/v2/de/cards/${cardId}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const data = (await r.json()) as { name?: string };
    return data?.name ?? null;
  } catch {
    return null;
  }
}

async function hasDeEntry(recordId: string, col: string): Promise<boolean> {
  const rows = await db
    .select({ id: localizationsTable.id })
    .from(localizationsTable)
    .where(
      and(
        eq(localizationsTable.table_name, "cards"),
        eq(localizationsTable.column_name, col),
        eq(localizationsTable.record_id, recordId),
        eq(localizationsTable.language, LANG),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function main() {
  const stillMissing = JSON.parse(
    fs.readFileSync(STILL_MISSING_PATH, "utf-8"),
  ) as { id: string; setId: string; englishName: string }[];

  let namesSeeded = 0;
  let imagesSeeded = 0;
  const resolvedIds = new Set<string>();

  // ── Phase 1: Seed German names ──────────────────────────────────────────
  console.log("\n=== Phase 1: Seeding German names ===\n");

  for (const card of stillMissing) {
    // Skip if already has German name
    if (await hasDeEntry(card.id, "name")) {
      console.log(`  ${card.id}: ✅ name already exists`);
      continue;
    }

    // Try TCGDex DE first
    let deName: string | null = await tryTcgdexDeName(card.id);
    let source = "tcgdex-de";

    if (!deName) {
      deName = KNOWN_GERMAN_NAMES[card.id] ?? null;
      source = "hardcoded";
    }

    if (!deName) {
      console.log(
        `  ${card.id}: ⚠️  no German name found (EN: ${card.englishName})`,
      );
      continue;
    }

    await upsert(card.id, "name", deName);
    namesSeeded++;
    console.log(`  ${card.id}: ✅ name "${deName}" [${source}]`);
  }

  console.log(`\nNames seeded: ${namesSeeded}`);

  // ── Phase 2: Seed confirmed S3 images ──────────────────────────────────
  console.log("\n=== Phase 2: Seeding confirmed S3 images ===\n");

  for (const { id, cmCode, idProduct } of CONFIRMED_IMAGES) {
    const url = `${S3_BASE}/${cmCode}/${idProduct}/${idProduct}.jpg`;
    if (await imageExists(url)) {
      await upsert(id, "image_small", url);
      await upsert(id, "image_large", url);
      imagesSeeded++;
      resolvedIds.add(id);
      console.log(`  ${id} (${cmCode}/${idProduct}) → ✅ seeded`);
    } else {
      console.log(`  ${id} (${cmCode}/${idProduct}) → ❌ S3 image not found`);
    }
  }

  console.log(`\nImages seeded: ${imagesSeeded}`);

  // ── Phase 3: Update still-missing.json ──────────────────────────────────
  const updatedMissing = stillMissing.filter((c) => !resolvedIds.has(c.id));
  fs.writeFileSync(STILL_MISSING_PATH, JSON.stringify(updatedMissing, null, 2));

  console.log(
    `\nstill-missing.json: ${stillMissing.length} → ${updatedMissing.length} remaining`,
  );

  if (updatedMissing.length > 0) {
    console.log(
      "\nRemaining (no German image found — will use English fallback):",
    );
    updatedMissing.forEach((c) => console.log(`  ${c.id}: ${c.englishName}`));
  }

  console.log("\n✅ Done. German names seeded; gym2-75/76 images seeded.");

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
