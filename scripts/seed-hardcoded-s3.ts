// seed-hardcoded-s3.ts
// Seed known S3 URLs for cards that TCGDex doesn't have idProduct data for,
// but we've identified via sequential analysis.
//
// Run: npx tsx --tsconfig tsconfig.scripts.json scripts/seed-hardcoded-s3.ts

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { db, localizationsTable } from "../src/lib/db/index";
import { eq, and, sql } from "drizzle-orm";

const S3_BASE = "https://product-images.s3.cardmarket.com/51";
const REFERER = "https://www.cardmarket.com/";

async function imageExists(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, {
      method: "HEAD",
      headers: { Referer: REFERER, "User-Agent": "Mozilla/5.0" },
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function upsert(recordId: string, col: string, value: string) {
  const existing = await db
    .select({ id: localizationsTable.id })
    .from(localizationsTable)
    .where(
      and(
        eq(localizationsTable.table_name, "cards"),
        eq(localizationsTable.column_name, col),
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
      column_name: col,
      record_id: recordId,
      language: "de",
      value,
    });
  }
}

// Cards with known S3 idProducts (derived from sequential analysis)
// Format: [cardId, setCode, idProduct]
const KNOWN_IDS: [string, string, number][] = [
  // ex7 Star cards - sequential from ex7-106 (TRR/276398)
  ["ex7-107", "TRR", 276399], // Mudkip ☆
  ["ex7-108", "TRR", 276400], // Torchic ☆
  ["ex7-109", "TRR", 276401], // Treecko ☆
];

async function main() {
  const missingPath = path.join(process.cwd(), "public", "still-missing.json");
  const allMissing = JSON.parse(fs.readFileSync(missingPath, "utf-8")) as any[];
  const resolvedIds = new Set<string>();

  for (const [cardId, setCode, idProduct] of KNOWN_IDS) {
    const url = `${S3_BASE}/${setCode}/${idProduct}/${idProduct}.jpg`;
    process.stdout.write(`${cardId} (${setCode}/${idProduct}) → `);

    const exists = await imageExists(url);
    if (!exists) {
      console.log(`❌ image 404`);
      continue;
    }

    await upsert(cardId, "image_small", url);
    await upsert(cardId, "image_large", url);
    resolvedIds.add(cardId);
    console.log(`✅ seeded`);
  }

  const remaining = allMissing.filter((c: any) => !resolvedIds.has(c.id));
  fs.writeFileSync(missingPath, JSON.stringify(remaining, null, 2));
  console.log(
    `\nSeeded ${resolvedIds.size} cards. Remaining: ${remaining.length}`,
  );
}

main().catch(console.error);
