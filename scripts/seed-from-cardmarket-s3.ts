// seed-from-cardmarket-s3.ts
// Alternative Cardmarket image seeder that uses TCGDex pricing.cardmarket.idProduct
// to construct direct S3 URLs — bypasses Cardmarket HTML scraping entirely.
//
// S3 URL format:  https://product-images.s3.cardmarket.com/51/{SetCode}/{idProduct}/{idProduct}.jpg
//
// Set codes (Cardmarket internal abbreviations):
//   gym1  → GH   gym2  → GC   ex7   → TRR  bw11  → LTR
//   sm7.5 → DRM  smp   → SMP  hgssp → HGSS swshp → SWSH  svp → SVP
//   xyp   → XY   sm4   → CIN
//
// Run: npx tsx --tsconfig tsconfig.scripts.json scripts/seed-from-cardmarket-s3.ts

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { db, cardsTable, localizationsTable } from "../src/lib/db/index";
import { eq, and, sql } from "drizzle-orm";
import type { Language } from "../src/lib/db/enums";

// ---------------------------------------------------------------------------
// Set → Cardmarket code mapping
// These are the abbreviation codes used in Cardmarket S3 image paths.
// ---------------------------------------------------------------------------
const SET_CODES: Record<string, string> = {
  gym1: "GH",
  gym2: "GC",
  ex7: "TRR",
  bw11: "LTR",
  "sm7.5": "DRM",
  // Smaller promo sets — localId already contains the code prefix for some
  smp: "SMP",
  hgssp: "HGSS",
  swshp: "SWSH",
  xyp: "XY",
  svp: "SVP",
  sm4: "CIN",
  pl2: "RR",
  ecard2: "AQ",
  ecard3: "SK",
};

const S3_BASE = "https://product-images.s3.cardmarket.com/51";

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------
async function upsertLocalization(
  tableName: string,
  columnName: string,
  recordId: string,
  lang: Language,
  value: string,
): Promise<void> {
  const existing = await db
    .select({ id: localizationsTable.id })
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
// HTTP helpers
// ---------------------------------------------------------------------------
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fetch idProduct for a card from TCGDex EN. Returns null if not found. */
async function getTcgdexIdProduct(cardId: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.tcgdex.net/v2/en/cards/${cardId}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    return data?.pricing?.cardmarket?.idProduct ?? null;
  } catch {
    return null;
  }
}

/** Check if a Cardmarket S3 image URL exists via HEAD request.
 *  The S3 bucket requires Referer: https://www.cardmarket.com/ to allow access.
 */
async function imageExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: {
        Referer: "https://www.cardmarket.com/",
        "User-Agent": "Mozilla/5.0 (compatible; Bulkratte/1.0)",
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

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
  status: string;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const missingPath = path.join(process.cwd(), "public", "still-missing.json");
  const allMissing = JSON.parse(
    fs.readFileSync(missingPath, "utf-8"),
  ) as MissingCard[];

  // Filter to sets we have S3 codes for
  const targetSets = new Set(Object.keys(SET_CODES));
  const toProcess = allMissing.filter((c) => targetSets.has(c.setId));
  const bySet = new Map<string, MissingCard[]>();
  for (const card of toProcess) {
    if (!bySet.has(card.setId)) bySet.set(card.setId, []);
    bySet.get(card.setId)!.push(card);
  }

  const skippedSets = [
    ...new Set(
      allMissing.filter((c) => !targetSets.has(c.setId)).map((c) => c.setId),
    ),
  ];

  console.log(`\n🃏  Cardmarket S3 direct image seeder`);
  console.log(
    `   ${[...bySet.keys()].length} sets to process (${toProcess.length} cards)`,
  );
  if (skippedSets.length > 0) {
    console.log(`   ⚡ Skipping (no S3 code): ${skippedSets.join(", ")}`);
  }
  console.log();

  const resolvedIds = new Set<string>();
  let totalSeeded = 0;
  let totalNotFound = 0;
  let totalErrors = 0;

  // Priority order: largest sets first
  const prioritySets = [
    "gym1",
    "gym2",
    "ex7",
    "ecard2",
    "ecard3",
    "bw11",
    "sm7.5",
    "smp",
    "svp",
    "swshp",
    "pl2",
    "xyp",
    "hgssp",
    "sm4",
  ];
  const setOrder = [
    ...prioritySets.filter((s) => bySet.has(s)),
    ...[...bySet.keys()].filter((s) => !prioritySets.includes(s)),
  ];

  for (const setId of setOrder) {
    const setCode = SET_CODES[setId]!;
    const cards = bySet.get(setId)!;
    console.log(`\n  📂 ${setId} (${cards.length} cards, S3 code: ${setCode})`);

    let setSeeded = 0;
    let setNotFound = 0;
    let setErrors = 0;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]!;
      process.stdout.write(
        `     [${i + 1}/${cards.length}] ${card.id} (${card.englishName})… `,
      );

      // Step 1: Get idProduct from TCGDex
      const idProduct = await getTcgdexIdProduct(card.id);
      if (!idProduct) {
        console.log(`⚠️  no idProduct from TCGDex`);
        setNotFound++;
        totalNotFound++;
        continue;
      }

      // Step 2: Construct S3 URL
      const s3Url = `${S3_BASE}/${setCode}/${idProduct}/${idProduct}.jpg`;

      // Step 3: Verify image exists
      const exists = await imageExists(s3Url);
      if (!exists) {
        // Try without the .jpg (some images use different formats)
        const altUrl = `${S3_BASE}/${setCode}/${idProduct}/${idProduct}.png`;
        const altExists = await imageExists(altUrl);
        if (!altExists) {
          console.log(`🔍 image not found (idProduct=${idProduct}): ${s3Url}`);
          setNotFound++;
          totalNotFound++;
          continue;
        }
        // Use PNG
        try {
          await upsertLocalization(
            "cards",
            "image_small",
            card.id,
            "de",
            altUrl,
          );
          await upsertLocalization(
            "cards",
            "image_large",
            card.id,
            "de",
            altUrl,
          );
          resolvedIds.add(card.id);
          setSeeded++;
          totalSeeded++;
          console.log(
            `✅ [PNG] idProduct=${idProduct} → ${altUrl.slice(0, 60)}…`,
          );
        } catch (err) {
          console.error(`❌ DB error: ${err}`);
          setErrors++;
          totalErrors++;
        }
        continue;
      }

      // Step 4: Seed the S3 URL
      try {
        await upsertLocalization("cards", "image_small", card.id, "de", s3Url);
        await upsertLocalization("cards", "image_large", card.id, "de", s3Url);
        resolvedIds.add(card.id);
        setSeeded++;
        totalSeeded++;
        console.log(`✅ idProduct=${idProduct} → ${s3Url.slice(0, 60)}…`);
      } catch (err) {
        console.error(`❌ DB error: ${err}`);
        setErrors++;
        totalErrors++;
      }

      // Small delay to be polite to S3 (no auth needed but still respectful)
      if (i < cards.length - 1) await sleep(200);
    }

    const icon =
      setSeeded === cards.length ? "✅" : setSeeded > 0 ? "🟡" : "❌";
    console.log(
      `  ${icon} ${setId}: seeded=${setSeeded}, not-found=${setNotFound}, errors=${setErrors}`,
    );
  }

  // Update still-missing.json
  const remaining = allMissing.filter((c) => !resolvedIds.has(c.id));
  fs.writeFileSync(missingPath, JSON.stringify(remaining, null, 2));

  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ Seeded:    ${totalSeeded}`);
  console.log(`🔍 Not found: ${totalNotFound}`);
  if (totalErrors > 0) console.log(`❌ Errors:   ${totalErrors}`);
  console.log(`⏳ Remaining: ${remaining.length} / ${allMissing.length}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
