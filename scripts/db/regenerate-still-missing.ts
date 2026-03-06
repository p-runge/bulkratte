// regenerate-still-missing.ts
// Rebuild still-missing.json with ALL cards that currently lack German images
// in sets that are known to have German prints.
//
// Run: npx tsx --tsconfig tsconfig.scripts.json scripts/db/regenerate-still-missing.ts

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import {
  db,
  setsTable,
  cardsTable,
  localizationsTable,
} from "../../src/lib/db/index";
import { eq, and, sql, not, inArray } from "drizzle-orm";
import { count } from "drizzle-orm";

// Sets known to have had German prints (i.e. skip purely English-market sets)
const GERMAN_SETS = new Set([
  "base1",
  "base2",
  "base3",
  "base5",
  "base4",
  "gym1",
  "gym2",
  "neo1",
  "neo2",
  "neo3",
  "neo4",
  "basep",
  "ecard1",
  "ecard2",
  "ecard3",
  "ex1",
  "ex2",
  "ex3",
  "ex4",
  "ex6",
  "ex7",
  "ex8",
  "ex9",
  "ex10",
  "ex11",
  "ex12",
  "ex13",
  "ex14",
  "ex15",
  "ex16",
  "dp1",
  "dp2",
  "dp3",
  "dp4",
  "dp5",
  "dp6",
  "dp7",
  "dpp",
  "pl1",
  "pl2",
  "pl3",
  "pl4",
  "hgss1",
  "hgss2",
  "hgss3",
  "hgss4",
  "hgssp",
  "bw1",
  "bw2",
  "bw3",
  "bw4",
  "bw5",
  "bw6",
  "bw7",
  "bw8",
  "bw9",
  "bw10",
  "bw11",
  "bwp",
  "col1",
  "g1",
  "dv1",
  "xy1",
  "xy2",
  "xy3",
  "xy4",
  "xy5",
  "xy6",
  "xy7",
  "xy8",
  "xy9",
  "xy10",
  "xy11",
  "xyp",
  "sm1",
  "sm2",
  "sm3",
  "sm4",
  "sm5",
  "sm6",
  "sm7",
  "sm7.5",
  "sm8",
  "sm9",
  "sm10",
  "sm11",
  "sm12",
  "smp",
  "swsh1",
  "swsh2",
  "swsh3",
  "swsh4",
  "swsh5",
  "swsh6",
  "swsh7",
  "swsh8",
  "swsh9",
  "swsh10",
  "swsh11",
  "swsh12",
  "swshp",
  "sv1",
  "sv2",
  "sv3",
  "sv3.5",
  "sv4",
  "sv4.5",
  "sv5",
  "sv6",
  "sv6.5",
  "sv7",
  "sv7.5",
  "sv8",
  "sv8.5",
  "sv9",
  "sv10",
  "svp",
]);

async function run() {
  const MISSING_FILE = path.join(__dirname, "../../public/still-missing.json");

  // Get all cards that are in GERMAN_SETS and have no German image_large
  const rows = (
    await db.execute(sql`
    SELECT 
      c.id, c.name AS english_name, c.number AS local_id,
      s.id AS set_id, s.name AS set_name,
      l_img.value AS de_image,
      l_name.value AS de_name
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    LEFT JOIN localizations l_img ON l_img.table_name='cards' 
                                  AND l_img.column_name='image_large'
                                  AND l_img.record_id=c.id 
                                  AND l_img.language='de'
    LEFT JOIN localizations l_name ON l_name.table_name='cards'
                                   AND l_name.column_name='name'  
                                   AND l_name.record_id=c.id
                                   AND l_name.language='de'
    WHERE l_img.id IS NULL
    ORDER BY s.release_date, c.number
  `)
  ).rows as any[];

  // Filter to German-market sets only
  const missing = rows
    .filter((r) => GERMAN_SETS.has(r.set_id))
    .map((r) => ({
      setId: r.set_id,
      setName: r.set_name,
      id: r.id,
      localId: r.local_id,
      englishName: r.english_name,
      germanName: r.de_name ?? null,
      hasGermanImage: false,
      germanImageUrl: null,
      pokewikiFilename: null,
      pokewikiUrl: null,
      status: "missing",
    }));

  fs.writeFileSync(MISSING_FILE, JSON.stringify(missing, null, 2));
  console.log(`📋 Regenerated still-missing.json with ${missing.length} cards`);

  // Show breakdown by set
  const bySet: Record<string, number> = {};
  for (const c of missing) {
    bySet[c.setId] = (bySet[c.setId] ?? 0) + 1;
  }
  for (const [setId, n] of Object.entries(bySet)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)) {
    console.log(`  ${setId.padEnd(15)} ${n}`);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
