export const dynamic = "force-dynamic";

import { db, setsTable, cardsTable, localizationsTable } from "@/lib/db";
import { LOCALES, DEFAULT_LOCALE, getLanguageFromLocale } from "@/lib/i18n";
import { eq, and, count, not } from "drizzle-orm";
import {
  StatusTable,
  type CellStatus,
  type CellData,
  type SetRow,
  type LanguageInfo,
} from "./_components/status-table";

// ── Language list (derived from LOCALES — add a locale → gets a column) ──────

const LANG_META: Record<string, { name: string; flag: string }> = {
  en: { name: "English", flag: "🇺🇸" },
  es: { name: "Spanish", flag: "🇪🇸" },
  fr: { name: "French", flag: "🇫🇷" },
  de: { name: "German", flag: "🇩🇪" },
  it: { name: "Italian", flag: "🇮🇹" },
  pt: { name: "Portuguese", flag: "🇵🇹" },
};

const LANGUAGES: LanguageInfo[] = LOCALES.map((locale) => {
  const code = getLanguageFromLocale(locale);
  const meta = LANG_META[code] ?? { name: code, flag: "🏳️" };
  return { locale, code, isDefault: locale === DEFAULT_LOCALE, ...meta };
});

// ── Status logic ──────────────────────────────────────────────────────────────
//
// Green   (complete)       — all card images present
// Purple  (missing_images) — has names for all cards, but images incomplete
// Yellow  (missing_names) — has some data but names incomplete
// Red     (not_seeded)     — not yet processed by seed; set may exist in language
// Black   (nonexistent)    — confirmed doesn't exist in this language
//                            (_processed marker present but 0 cards from API)

function getCellStatus(
  totalCards: number,
  withImage: number,
  withName: number,
  isProcessed: boolean,
): CellStatus {
  if (totalCards === 0) return "nonexistent";

  if (withImage >= totalCards) return "complete";

  if (withImage > 0 || withName > 0) {
    if (withName >= totalCards) return "missing_images"; // all names, images missing
    return "missing_names"; // names incomplete
  }

  // No data at all
  if (isProcessed) return "nonexistent"; // seed ran, TCGdex returned 0 → doesn't exist
  return "not_seeded"; // never processed → might exist, needs seeding
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchStatusData(): Promise<{
  rows: SetRow[];
  languages: LanguageInfo[];
}> {
  const sets = await db
    .select()
    .from(setsTable)
    .where(not(eq(setsTable.series, "Pokémon TCG Pocket")))
    .orderBy(setsTable.releaseDate);

  const cardCountRows = await db
    .select({ setId: cardsTable.setId, total: count() })
    .from(cardsTable)
    .groupBy(cardsTable.setId);
  const cardCountMap = new Map(cardCountRows.map((r) => [r.setId, r.total]));

  const imageRows = await db
    .select({
      setId: cardsTable.setId,
      language: localizationsTable.language,
      n: count(),
    })
    .from(localizationsTable)
    .innerJoin(cardsTable, eq(localizationsTable.record_id, cardsTable.id))
    .where(
      and(
        eq(localizationsTable.table_name, "cards"),
        eq(localizationsTable.column_name, "image_small"),
      ),
    )
    .groupBy(cardsTable.setId, localizationsTable.language);
  const imageMap = new Map(
    imageRows.map((r) => [`${r.setId}:${r.language}`, r.n]),
  );

  const nameRows = await db
    .select({
      setId: cardsTable.setId,
      language: localizationsTable.language,
      n: count(),
    })
    .from(localizationsTable)
    .innerJoin(cardsTable, eq(localizationsTable.record_id, cardsTable.id))
    .where(
      and(
        eq(localizationsTable.table_name, "cards"),
        eq(localizationsTable.column_name, "name"),
      ),
    )
    .groupBy(cardsTable.setId, localizationsTable.language);
  const nameMap = new Map(
    nameRows.map((r) => [`${r.setId}:${r.language}`, r.n]),
  );

  // _processed markers: written by seed-localizations.ts after trying a set in a language.
  // If present but withName=0, TCGdex had the set in its language list but returned 0 cards
  // → the set genuinely doesn't exist in that language.
  const processedRows = await db
    .select({
      record_id: localizationsTable.record_id,
      language: localizationsTable.language,
    })
    .from(localizationsTable)
    .where(
      and(
        eq(localizationsTable.table_name, "sets"),
        eq(localizationsTable.column_name, "_processed"),
      ),
    );
  const processedSet = new Set(
    processedRows.map((r) => `${r.record_id}:${r.language}`),
  );

  const rows: SetRow[] = sets.map((set) => {
    const totalCards = cardCountMap.get(set.id) ?? 0;
    const cells: Record<string, CellData> = {};

    for (const lang of LANGUAGES) {
      if (lang.isDefault) continue;

      const withImage = imageMap.get(`${set.id}:${lang.code}`) ?? 0;
      const withName = nameMap.get(`${set.id}:${lang.code}`) ?? 0;
      const isProcessed = processedSet.has(`${set.id}:${lang.code}`);

      cells[lang.code] = {
        status: getCellStatus(totalCards, withImage, withName, isProcessed),
        count: withImage,
        nameCount: withName,
        total: totalCards,
      };
    }

    return {
      setId: set.id,
      setName: set.name,
      series: set.series,
      totalCards,
      cells,
    };
  });

  return { rows, languages: LANGUAGES };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StatusPage() {
  const { rows, languages } = await fetchStatusData();

  const statusCounts: Record<CellStatus, number> = {
    complete: 0,
    missing_images: 0,
    missing_names: 0,
    not_seeded: 0,
    nonexistent: 0,
  };
  for (const row of rows) {
    for (const cell of Object.values(row.cells)) {
      statusCounts[cell.status]++;
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-full mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-zinc-100 mb-1">
            Bulkratte Progress
          </h1>
          <p className="text-zinc-500 text-sm">
            {rows.length} sets · {statusCounts.complete} complete ·{" "}
            {statusCounts.missing_images} missing images ·{" "}
            {statusCounts.missing_names} missing names ·{" "}
            {statusCounts.not_seeded} not seeded · {statusCounts.nonexistent} nonexistent (across all
            non-default languages)
          </p>
        </div>

        <StatusTable rows={rows} languages={languages} />

        <p className="mt-4 text-zinc-700 text-xs">
          Coverage based on <code className="text-zinc-500">image_small</code>{" "}
          localizations · English is always complete (native language)
        </p>
      </div>
    </main>
  );
}
