/**
 * cleanup-de-overshoot.ts
 *
 * Cleans up German (DE) localizations in the DB so that only cards that were
 * officially released in German are kept.
 *
 * Strategy:
 *  1. Pokémon TCG Pocket / Mega Evolution sets → delete ALL their DE data
 *     (these are a separate product not tracked in the physical TCG app)
 *  2. All other sets → fetch /v2/de/sets/{id} from TCGDex:
 *     - cardCount.official == 0 (e.g. svp, mep) → delete all DE card locs
 *     - cardCount.official > 0 → the `cards` array has exactly the official
 *       German cards; delete DE locs for cards NOT in that list
 *
 * After deleting excess data, `_processed` markers are added so the seeding
 * script skips these sets in future runs.
 *
 * Run: npx tsx --tsconfig tsconfig.scripts.json scripts/cleanup-de-overshoot.ts
 * Dry run: DRY_RUN=1 npx tsx --tsconfig tsconfig.scripts.json scripts/cleanup-de-overshoot.ts
 */

import "dotenv/config";
import { Client } from "pg";

const DB_URL = process.env.DATABASE_URL!;
const DRY_RUN = process.env.DRY_RUN === "1";

/** Series names whose sets are part of Pokémon TCG Pocket — skip entirely */
const POCKET_SERIES = new Set(["Pokémon TCG Pocket", "Mega Evolution"]);

interface TcgDexSetInfo {
  cardCount: { total: number; official: number };
  cards: Array<{ id: string }>;
}

async function fetchDeSetInfo(
  setId: string
): Promise<TcgDexSetInfo | null> {
  try {
    const res = await fetch(`https://api.tcgdex.net/v2/de/sets/${setId}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      cardCount: data.cardCount ?? { total: 0, official: 0 },
      cards: data.cards ?? [],
    };
  } catch {
    return null;
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (DRY_RUN) console.log("⚠️  DRY RUN — no changes will be written\n");

  const db = new Client({ connectionString: DB_URL });
  await db.connect();

  try {
    // 1. Get all sets that have any DE card localizations, with their series
    const setsRes = await db.query<{
      set_id: string;
      series: string;
      img_count: string;
      name_count: string;
    }>(`
      SELECT
        c.set_id,
        s.series,
        COUNT(DISTINCT CASE WHEN l.column_name = 'image_small' THEN l.record_id END)::text AS img_count,
        COUNT(DISTINCT CASE WHEN l.column_name = 'name'        THEN l.record_id END)::text AS name_count
      FROM localizations l
      JOIN cards c ON c.id = l.record_id
      JOIN sets s ON s.id = c.set_id
      WHERE l.language = 'de' AND l.table_name = 'cards'
      GROUP BY c.set_id, s.series
      ORDER BY c.set_id
    `);

    console.log(`Sets with DE card localizations: ${setsRes.rows.length}\n`);

    let totalDeletedCards = 0;
    let totalDeletedRows = 0;
    let setsFullyDeleted = 0;
    let setsTrimmed = 0;
    let setsAlreadyClean = 0;

    for (const row of setsRes.rows) {
      const { set_id: setId, series } = row;
      const isPocket = POCKET_SERIES.has(series);

      // Get all card IDs (in this set) that have DE localizations
      const cardIdsRes = await db.query<{ record_id: string }>(`
        SELECT DISTINCT l.record_id
        FROM localizations l
        JOIN cards c ON c.id = l.record_id
        WHERE l.language = 'de' AND l.table_name = 'cards' AND c.set_id = $1
      `, [setId]);

      const dbCardIds = cardIdsRes.rows.map((r) => r.record_id);

      let cardsToDelete: string[] = [];
      let reason: string;

      if (isPocket) {
        cardsToDelete = dbCardIds;
        reason = `POCKET (${series})`;
      } else {
        // Fetch official German card list from TCGDex
        const info = await fetchDeSetInfo(setId);
        await sleep(120); // be polite to the API

        if (!info || info.cardCount.official === 0) {
          cardsToDelete = dbCardIds;
          reason = info
            ? `NO-DE (TCGDex official=0)`
            : `NO-DE (TCGDex 404/error)`;
        } else if (info.cards.length === 0) {
          // TCGDex has official German cards but doesn't return the card list
          // for this set (API gap for older sets). Keep all existing DE data.
          cardsToDelete = [];
          reason = `SKIP (official=${info.cardCount.official}, no card list from TCGDex)`;
        } else {
          // The cards array from the DE endpoint lists all cards that have
          // German data (can be more than cardCount.official — TCGDex returns
          // the full set when German images exist, even for secret rares that
          // weren't officially printed in DE).
          // Delete only cards whose IDs are not in the TCGDex DE response at all.
          const tcgIds = new Set(info.cards.map((c) => c.id));
          cardsToDelete = dbCardIds.filter((id) => !tcgIds.has(id));
          reason = `TRIM (tcg_cards=${info.cards.length}, db=${dbCardIds.length}, excess=${cardsToDelete.length})`;
        }
      }

      if (cardsToDelete.length === 0) {
        console.log(`✓  ${setId.padEnd(10)} — already clean`);
        setsAlreadyClean++;
        continue;
      }

      // Count rows that will be deleted
      const countRes = await db.query<{ cnt: string }>(`
        SELECT COUNT(*)::text AS cnt
        FROM localizations
        WHERE language = 'de' AND table_name = 'cards' AND record_id = ANY($1)
      `, [cardsToDelete]);
      const rowsToDelete = parseInt(countRes.rows[0].cnt);

      console.log(
        `✗  ${setId.padEnd(10)} ${reason} → deleting ${cardsToDelete.length} cards (${rowsToDelete} rows)`
      );

      if (!DRY_RUN) {
        const delRes = await db.query(`
          DELETE FROM localizations
          WHERE language = 'de' AND table_name = 'cards' AND record_id = ANY($1)
        `, [cardsToDelete]);
        totalDeletedRows += delRes.rowCount ?? 0;
      } else {
        totalDeletedRows += rowsToDelete;
      }
      totalDeletedCards += cardsToDelete.length;

      if (isPocket || cardsToDelete.length === dbCardIds.length) {
        setsFullyDeleted++;
      } else {
        setsTrimmed++;
      }
    }

    console.log(`\n${"─".repeat(60)}`);
    console.log(`Sets fully cleared:  ${setsFullyDeleted}`);
    console.log(`Sets trimmed:        ${setsTrimmed}`);
    console.log(`Sets already clean:  ${setsAlreadyClean}`);
    console.log(`Cards deleted:       ${totalDeletedCards}`);
    console.log(`Localization rows:   ${totalDeletedRows}`);

    if (DRY_RUN) {
      console.log("\n(DRY RUN — nothing was written)");
      return;
    }

    // ------------------------------------------------------------------
    // 2.  Clean up set-level DE localizations for fully-cleared sets
    //     (name, series — but preserve _processed markers we add below)
    // ------------------------------------------------------------------
    console.log("\nCleaning up set-level DE data for Pocket series...");
    const pocketSetsRes = await db.query<{ id: string }>(`
      SELECT id FROM sets WHERE series = ANY($1)
    `, [Array.from(POCKET_SERIES)]);

    for (const { id: setId } of pocketSetsRes.rows) {
      // Delete non-_processed set-level DE locs
      const del = await db.query(`
        DELETE FROM localizations
        WHERE language = 'de' AND table_name = 'sets' AND record_id = $1
          AND column_name != '_processed'
      `, [setId]);
      if ((del.rowCount ?? 0) > 0) {
        console.log(`  Removed ${del.rowCount} set-level DE rows for ${setId}`);
      }

      // Ensure _processed marker exists (so seeder skips in future)
      const exists = await db.query(
        `SELECT 1 FROM localizations
         WHERE table_name = 'sets' AND column_name = '_processed'
           AND record_id = $1 AND language = 'de'`,
        [setId]
      );
      if (exists.rowCount === 0) {
        await db.query(`
          INSERT INTO localizations (id, table_name, column_name, record_id, language, value)
          VALUES (gen_random_uuid(), 'sets', '_processed', $1, 'de', '1')
        `, [setId]);
        console.log(`  Added _processed marker for ${setId}`);
      }
    }

    // ------------------------------------------------------------------
    // 3.  Add _processed markers for zero-official sets (svp, mep, etc.)
    //     that were fully cleared but are NOT Pocket sets
    // ------------------------------------------------------------------
    console.log("\nAdding _processed markers for fully-cleared physical sets...");
    // Re-check: physical sets that now have 0 DE card locs
    const clearedPhysicalRes = await db.query<{ set_id: string }>(`
      SELECT DISTINCT c.set_id
      FROM sets s
      JOIN cards c ON c.set_id = s.id
      WHERE s.series NOT IN (${Array.from(POCKET_SERIES).map((_, i) => `$${i + 1}`).join(",")})
        AND NOT EXISTS (
          SELECT 1 FROM localizations l2
          JOIN cards c2 ON c2.id = l2.record_id
          WHERE l2.language = 'de' AND l2.table_name = 'cards' AND c2.set_id = c.set_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM localizations
          WHERE table_name = 'sets' AND column_name = '_processed'
            AND record_id = c.set_id AND language = 'de'
        )
    `, Array.from(POCKET_SERIES));

    for (const { set_id: setId } of clearedPhysicalRes.rows) {
      await db.query(`
        INSERT INTO localizations (id, table_name, column_name, record_id, language, value)
        VALUES (gen_random_uuid(), 'sets', '_processed', $1, 'de', '1')
      `, [setId]);
      console.log(`  Added _processed marker for ${setId}`);
    }

    console.log("\n✅  Cleanup complete!");
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
