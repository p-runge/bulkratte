// Cleans up incorrect DE localizations for base4, bw11, ex7:
// - These sets were never released in German
// - Existing DE entries came from manual seeding scripts (wrong data)
// - Deletes all DE card + set localizations, then inserts _processed markers
//   so the status page shows them as black (nonexistent for DE)

import { Client } from 'pg';
import { env } from "@/env";

async function run() {
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();

  const SETS = ['base4', 'bw11', 'ex7'];
  const setList = SETS.map(s => `'${s}'`).join(', ');

  // 1. Count what will be deleted
  const before = await client.query(
    `SELECT c.set_id, l.column_name, COUNT(*) as cnt
     FROM localizations l
     JOIN cards c ON c.id = l.record_id
     WHERE l.language = 'de' AND c.set_id IN (${setList})
     GROUP BY c.set_id, l.column_name
     ORDER BY c.set_id, l.column_name`
  );
  console.log('Rows to be deleted:');
  before.rows.forEach((r: any) => console.log(`  ${r.set_id}  ${r.column_name}  ${r.cnt}`));

  // 2. Delete all DE card-level localizations for gym1/gym2
  const del = await client.query(
    `DELETE FROM localizations
     WHERE language = 'de'
       AND record_id IN (
         SELECT id FROM cards WHERE set_id IN (${setList})
       )`
  );
  console.log(`\nDeleted ${del.rowCount} card-level DE localization rows.`);

  // 3. Delete any existing set-level DE rows (names, series, etc.)
  const delSet = await client.query(
    `DELETE FROM localizations
     WHERE language = 'de'
       AND table_name = 'sets'
       AND record_id IN (${setList})`
  );
  console.log(`Deleted ${delSet.rowCount} set-level DE localization rows.`);

  // 4. Insert _processed markers so status page shows them as black (nonexistent)
  //    (delete first to avoid duplicates — no unique constraint, only a regular index)
  await client.query(
    `DELETE FROM localizations
     WHERE language = 'de' AND table_name = 'sets'
       AND column_name = '_processed'
       AND record_id IN (${setList})`
  );
  for (const setId of SETS) {
    const res = await client.query(
      `INSERT INTO localizations (table_name, column_name, record_id, language, value)
       VALUES ('sets', '_processed', $1, 'de', '1')`,
      [setId]
    );
    console.log(`Inserted _processed marker for ${setId}: ${res.rowCount} row(s) affected.`);
  }

  // 5. Verify nothing remains
  const after = await client.query(
    `SELECT COUNT(*) as cnt FROM localizations
     WHERE language = 'de' AND (
       record_id IN (SELECT id FROM cards WHERE set_id IN (${setList}))
       OR (table_name = 'sets' AND record_id IN (${setList}) AND column_name != '_processed')
     )`
  );
  console.log(`\nRemaining non-processed DE rows for gym1/gym2: ${after.rows[0].cnt} (should be 0)`);

  const markers = await client.query(
    `SELECT record_id, column_name, value FROM localizations
     WHERE language = 'de' AND table_name = 'sets' AND record_id IN (${setList})`
  );
  console.log('Set-level rows after cleanup:');
  markers.rows.forEach((r: any) => console.log(`  ${r.record_id}  ${r.column_name}=${r.value}`));

  await client.end();
  console.log('\nDone.');
}

run().catch(console.error);
