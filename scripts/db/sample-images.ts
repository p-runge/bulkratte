import { db } from "@/lib/db/index";
import { sql } from "drizzle-orm";

// Get one representative card per series era, preferring cards with images
async function main() {
  const results = await db.execute(sql`
    SELECT DISTINCT ON (s.series)
      s.id AS set_id,
      s.name AS set_name,
      s.series,
      s.release_date,
      c.number,
      c.image_large
    FROM sets s
    JOIN cards c ON c.set_id = s.id
    WHERE c.image_large IS NOT NULL
      AND s.series != 'Pokémon TCG Pocket'
    ORDER BY s.series, s.release_date ASC
    LIMIT 40
  `);

  for (const row of results.rows as Array<{
    set_id: string;
    set_name: string;
    series: string;
    release_date: string;
    number: string;
    image_large: string;
  }>) {
    console.log(
      `${row.series.padEnd(35)} | ${row.set_name.padEnd(30)} | #${row.number.padEnd(8)} | ${row.image_large}`,
    );
  }
}

main().catch(console.error);
