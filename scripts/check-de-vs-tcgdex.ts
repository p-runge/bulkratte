// Full DB vs TCGDex German audit:
// 1. Sets in DB with DE data but NOT in TCGDex DE list (should never have been seeded)
// 2. Sets IN TCGDex DE list where our DB card count EXCEEDS TCGDex's official German count
//    (we seeded more cards than were actually released in German)

import { Client } from 'pg';
import { env } from "@/env";

async function run() {
  // --- TCGDex: fetch DE set list with official card counts ---
  const resp = await fetch('https://api.tcgdex.net/v2/de/sets');
  const tcgdexSets: Array<{ id: string; name: string; cardCount: { total: number; official: number } }> = await resp.json();
  const tcgdexMap = new Map(tcgdexSets.map(s => [s.id, s]));
  console.log(`TCGDex DE sets: ${tcgdexMap.size}\n`);

  // --- DB: image/name counts per set ---
  const db = new Client({ connectionString: env.DATABASE_URL });
  await db.connect();

  const dbRows = await db.query<{
    set_id: string;
    set_name: string;
    total_cards: string;
    with_image: string;
    with_name: string;
  }>(
    `SELECT
       s.id AS set_id,
       s.name AS set_name,
       COUNT(DISTINCT c.id) AS total_cards,
       COUNT(DISTINCT CASE WHEN l.column_name = 'image_small' THEN l.record_id END) AS with_image,
       COUNT(DISTINCT CASE WHEN l.column_name = 'name'        THEN l.record_id END) AS with_name
     FROM sets s
     JOIN cards c ON c.set_id = s.id
     LEFT JOIN localizations l ON l.record_id = c.id AND l.language = 'de'
     GROUP BY s.id, s.name
     ORDER BY s.id`
  );

  const processedRes = await db.query<{ record_id: string }>(
    `SELECT record_id FROM localizations
     WHERE language = 'de' AND table_name = 'sets' AND column_name = '_processed' AND value = '1'`
  );
  const processedIds = new Set(processedRes.rows.map(r => r.record_id));

  await db.end();

  // --- Cross-reference ---
  type Row = {
    set_id: string; set_name: string; total: number;
    db_img: number; db_name: number; tcg_official: number | null; issue: string;
  };
  const discrepancies: Row[] = [];

  for (const row of dbRows.rows) {
    const dbImg  = parseInt(row.with_image);
    const dbName = parseInt(row.with_name);
    const dbTotal = parseInt(row.total_cards);

    if (dbImg === 0 && dbName === 0) continue; // no DE data — nothing to check
    if (processedIds.has(row.set_id)) continue; // already cleaned up

    const tcg = tcgdexMap.get(row.set_id);

    if (!tcg) {
      discrepancies.push({
        set_id: row.set_id, set_name: row.set_name, total: dbTotal,
        db_img: dbImg, db_name: dbName, tcg_official: null,
        issue: 'NOT IN TCGDEX DE LIST',
      });
      continue;
    }

    const tcgOfficial = tcg.cardCount.official;

    if (dbImg > tcgOfficial || dbName > tcgOfficial) {
      discrepancies.push({
        set_id: row.set_id, set_name: row.set_name, total: dbTotal,
        db_img: dbImg, db_name: dbName, tcg_official: tcgOfficial,
        issue: `DB exceeds TCGDex official (${tcgOfficial} German cards)`,
      });
    }
  }

  // --- Report ---
  if (discrepancies.length === 0) {
    console.log('All clear — no discrepancies found!');
    return;
  }

  console.log(`Found ${discrepancies.length} discrepant set(s):\n`);
  const c = (s: string, w: number) => s.padEnd(w);
  console.log(c('set_id',22) + c('set_name',30) + c('total',7) + c('db_img',9) + c('db_name',9) + c('tcg_off',9) + 'issue');
  console.log('-'.repeat(120));
  for (const d of discrepancies) {
    console.log(
      c(d.set_id, 22) +
      c(d.set_name.slice(0, 28), 30) +
      c(String(d.total), 7) +
      c(String(d.db_img), 9) +
      c(String(d.db_name), 9) +
      c(d.tcg_official === null ? 'N/A' : String(d.tcg_official), 9) +
      d.issue
    );
  }
}

run().catch(console.error);
