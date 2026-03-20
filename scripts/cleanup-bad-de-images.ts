/**
 * cleanup-bad-de-images.ts
 *
 * Removes German DE image localizations (image_small / image_large) for
 * physical TCG cards that accidentally got Pokémon TCG Pocket or Mega
 * Evolution image URLs assigned to them.
 *
 * These were seeded by scripts that matched Pokémon names across sets,
 * finding Pocket/ME results instead of the correct set-specific image.
 *
 * Affected image URL patterns:
 *   - %/tcgp/%      → TCG Pocket images (A1, A2, A2a, A3...)
 *   - de/me/%       → Mega Evolution images (me01, me02, me02.5)
 *
 * Cards will fall back to their English images (correct behaviour).
 *
 * Run: npx tsx --tsconfig tsconfig.scripts.json scripts/cleanup-bad-de-images.ts
 * Dry run: DRY_RUN=1 npx tsx --tsconfig tsconfig.scripts.json scripts/cleanup-bad-de-images.ts
 */

import "dotenv/config";
import { Client } from "pg";

const DRY_RUN = process.env.DRY_RUN === "1";

async function main() {
  if (DRY_RUN) console.log("⚠️  DRY RUN — no changes will be written\n");

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  try {
    // Show the breakdown by set first
    const breakdown = await db.query(`
      SELECT
        c.set_id,
        s.name AS set_name,
        COUNT(*) AS bad_rows
      FROM localizations l
      JOIN cards c ON c.id = l.record_id
      JOIN sets s ON s.id = c.set_id
      WHERE l.language = 'de'
        AND l.table_name = 'cards'
        AND l.column_name IN ('image_small', 'image_large')
        AND (l.value LIKE '%/tcgp/%' OR l.value LIKE '%assets.tcgdex.net/de/me/%')
      GROUP BY c.set_id, s.name
      ORDER BY bad_rows DESC
    `);

    console.log("Bad DE images found:");
    let totalRows = 0;
    for (const row of breakdown.rows) {
      console.log(`  ${row.set_id.padEnd(12)} ${row.set_name.padEnd(35)} ×${row.bad_rows} rows`);
      totalRows += parseInt(row.bad_rows);
    }
    console.log(`\nTotal: ${totalRows} rows to delete\n`);

    if (!DRY_RUN) {
      const result = await db.query(`
        DELETE FROM localizations
        WHERE language = 'de'
          AND table_name = 'cards'
          AND column_name IN ('image_small', 'image_large')
          AND (value LIKE '%/tcgp/%' OR value LIKE '%assets.tcgdex.net/de/me/%')
      `);
      console.log(`✅  Deleted ${result.rowCount} rows`);
    } else {
      console.log("(DRY RUN — nothing was written)");
    }
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
