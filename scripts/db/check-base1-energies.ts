import "dotenv/config";
import { db } from "../../src/lib/db/index";
import { sql } from "drizzle-orm";

async function run() {
  // Check if base1 energy cards (97-102) have German images
  const rows = await db.execute(sql`
    SELECT c.id, c.name, l.value AS de_image
    FROM cards c
    JOIN localizations l ON l.table_name='cards' AND l.column_name='image_large' 
                         AND l.record_id=c.id AND l.language='de'
    WHERE c.set_id='base1' AND c.number::int >= 95
    ORDER BY c.number::int
  `);

  if (rows.rows.length === 0) {
    console.log("❌ No base1 German energy images found");
  } else {
    for (const r of rows.rows as any[]) {
      console.log(
        `${r.id} (${r.name}): ${(r.de_image as string).slice(0, 90)}`,
      );
    }
  }
  process.exit(0);
}

run().catch(console.error);
