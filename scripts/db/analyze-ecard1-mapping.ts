import "dotenv/config";
import { db } from "../../src/lib/db/index";
import { sql } from "drizzle-orm";

async function run() {
  const rows = await db.execute(sql`
  SELECT c.id, c.number::int AS num, c.name AS en_name, c2.id AS holo_id, l.value AS holo_image
  FROM cards c
  LEFT JOIN cards c2 ON c2.set_id = 'ecard1' AND c2.name = c.name AND c2.number::int < 33
  LEFT JOIN localizations l
    ON l.table_name = 'cards' AND l.record_id = c2.id AND l.language = 'de' AND l.column_name = 'image_large'
  WHERE c.set_id = 'ecard1' AND c.number::int BETWEEN 33 AND 70
  ORDER BY c.number::int
`);

  console.log(`Total non-holo ecard1 cards (33-70): ${rows.rows.length}`);
  let withHolo = 0;
  let noHolo = 0;
  for (const r of rows.rows as any[]) {
    if (r.holo_image) {
      withHolo++;
      console.log(
        `  ✅ ${r.id} (${r.en_name}) → holo: ${r.holo_id} → ${r.holo_image}`,
      );
    } else {
      noHolo++;
      console.log(`  ❌ ${r.id} (${r.en_name}) → no holo found`);
    }
  }
  console.log(`\nWith holo image: ${withHolo}, Without: ${noHolo}`);
  process.exit(0);
}

run().catch(console.error);
