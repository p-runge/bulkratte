"use client";

import { useState, useMemo } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export type CellStatus =
  | "complete" // 100 % images → Green
  | "missing_images" // all names, but images incomplete → Purple
  | "missing_names" // some data but names incomplete → Yellow
  | "not_seeded" // exists in language but nothing in our DB yet → Red
  | "nonexistent"; // doesn't exist in this language → Black

export type CellData = {
  status: CellStatus;
  count: number; // images present
  nameCount: number; // names present
  total: number; // total cards in set
};

export type SetRow = {
  setId: string;
  setName: string;
  series: string;
  totalCards: number;
  cells: Record<string, CellData>; // keyed by language code
};

export type LanguageInfo = {
  code: string;
  name: string;
  flag: string;
  isDefault: boolean;
};

// ── Style maps ───────────────────────────────────────────────────────────────

export const STATUS_STYLES: Record<CellStatus | "en_default", string> = {
  en_default: "bg-green-900 text-green-300",
  complete: "bg-green-900 text-green-300",
  missing_images: "bg-purple-900 text-purple-300",
  missing_names: "bg-yellow-800 text-yellow-100",
  not_seeded: "bg-red-950 text-red-400",
  nonexistent: "bg-zinc-900 text-zinc-500",
};

export const STATUS_BORDER: Record<CellStatus | "en_default", string> = {
  en_default: "border border-green-700",
  complete: "border border-green-700",
  missing_images: "border border-purple-700",
  missing_names: "border border-yellow-600",
  not_seeded: "border border-red-800",
  nonexistent: "border border-zinc-600",
};

export const STATUS_LABEL: Record<CellStatus, string> = {
  complete: "Completed",
  missing_images: "Missing card images",
  missing_names: "Missing card names",
  not_seeded: "Not available",
  nonexistent: "Not existent",
};

const ALL_STATUSES: CellStatus[] = [
  "complete",
  "missing_images",
  "missing_names",
  "not_seeded",
  "nonexistent",
];

// ── Component ────────────────────────────────────────────────────────────────

export function StatusTable({
  rows,
  languages,
}: {
  rows: SetRow[];
  languages: LanguageInfo[];
}) {
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<CellStatus>>(
    new Set(ALL_STATUSES),
  );

  function toggleFilter(status: CellStatus) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        if (next.size === 1) return next; // keep at least one
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }

  function setOnlyFilter(status: CellStatus) {
    setActiveFilters(new Set([status]));
  }

  function clearFilters() {
    setActiveFilters(new Set(ALL_STATUSES));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      // Search filter
      if (
        q &&
        !row.setName.toLowerCase().includes(q) &&
        !row.setId.toLowerCase().includes(q) &&
        !row.series.toLowerCase().includes(q)
      ) {
        return false;
      }

      // If all statuses active, show everything
      if (activeFilters.size === ALL_STATUSES.length) return true;

      // Show row if ANY non-default language cell matches active filters
      return languages.some((lang) => {
        if (lang.isDefault) return false; // English is always complete — exclude from filter
        const cell = row.cells[lang.code];
        return cell ? activeFilters.has(cell.status) : false;
      });
    });
  }, [rows, languages, search, activeFilters]);

  // Total summary
  const totals = useMemo(() => {
    const map: Record<string, { total: number; withImage: number }> = {};
    for (const lang of languages) {
      map[lang.code] = { total: 0, withImage: 0 };
    }
    for (const row of rows) {
      for (const lang of languages) {
        map[lang.code]!.total += row.totalCards;
        if (lang.isDefault) {
          map[lang.code]!.withImage += row.totalCards;
        } else {
          map[lang.code]!.withImage += row.cells[lang.code]?.count ?? 0;
        }
      }
    }
    return map;
  }, [rows, languages]);

  const allFiltersActive = activeFilters.size === ALL_STATUSES.length;

  return (
    <div>
      {/* Legend */}
      <div className="mb-5">
        <div className="flex flex-wrap gap-3 text-sm">
          {ALL_STATUSES.map((status) => {
            const active = activeFilters.has(status);
            return (
              <button
                key={status}
                onClick={(e) => {
                  if (e.shiftKey) {
                    toggleFilter(status);
                  } else {
                    if (active && activeFilters.size === 1) {
                      clearFilters();
                    } else {
                      setOnlyFilter(status);
                    }
                  }
                }}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-full border transition-all cursor-pointer select-none
                  ${
                    active
                      ? "border-zinc-500 bg-zinc-800 text-zinc-200"
                      : "border-zinc-700 bg-zinc-900/50 text-zinc-500 opacity-50"
                  }`}
              >
                <span
                  className={`w-3 h-3 rounded-sm shrink-0 ${STATUS_STYLES[status]} ${STATUS_BORDER[status]}`}
                />
                <span className="text-xs">{STATUS_LABEL[status]}</span>
              </button>
            );
          })}
          {!allFiltersActive && (
            <button
              onClick={clearFilters}
              className="text-xs px-2.5 py-1 rounded-full border border-zinc-600 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Click a badge to filter by status · Shift+click to toggle
        </p>
      </div>

      {/* Search */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sets by name, ID, or series…"
            aria-label="Search sets by name, ID, or series"
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 placeholder:text-zinc-500 text-sm focus:outline-none focus:border-zinc-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              ✕
            </button>
          )}
        </div>
        <span className="text-zinc-500 text-xs whitespace-nowrap">
          {filtered.length} / {rows.length} sets
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-zinc-900 border-b border-zinc-800">
              <th className="sticky left-0 z-10 bg-zinc-900 text-left px-4 py-3 font-semibold text-zinc-300 whitespace-nowrap min-w-[220px]">
                Set
              </th>
              <th className="px-3 py-3 text-center text-zinc-400 font-medium whitespace-nowrap">
                #
              </th>
              {languages.map((lang) => (
                <th
                  key={lang.code}
                  className="px-3 py-3 text-center font-medium whitespace-nowrap min-w-[90px]"
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-lg leading-none">{lang.flag}</span>
                    <span className="text-xs text-zinc-400 uppercase tracking-wide">
                      {lang.code}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Summary row */}
            <tr className="bg-zinc-900/60 border-b border-zinc-700">
              <td className="sticky left-0 z-10 bg-zinc-900/80 px-4 py-2 text-zinc-400 whitespace-nowrap text-xs uppercase tracking-wider font-medium">
                All {rows.length} sets
              </td>
              <td className="px-3 py-2 text-center text-zinc-500 text-xs" />
              {languages.map((lang) => {
                const t = totals[lang.code]!;
                const pct =
                  t.total > 0 ? Math.round((t.withImage / t.total) * 100) : 0;
                const isComplete = pct >= 100;
                return (
                  <td key={lang.code} className="px-3 py-2 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold
                        ${isComplete ? "bg-green-900 text-green-300" : pct > 50 ? "bg-yellow-800 text-yellow-100" : "bg-zinc-800 text-zinc-300"}`}
                    >
                      {pct}%
                    </span>
                  </td>
                );
              })}
            </tr>

            {/* Per-set rows */}
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={2 + languages.length}
                  className="px-4 py-8 text-center text-zinc-500 text-sm"
                >
                  No sets match your search / filter
                </td>
              </tr>
            ) : (
              [...filtered].reverse().map((row) => (
                <tr
                  key={row.setId}
                  className="border-b border-zinc-800/60 hover:bg-zinc-800/20 transition-colors"
                >
                  <td className="sticky left-0 z-10 bg-zinc-950 hover:bg-zinc-900/70 px-4 py-1.5 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-zinc-200 font-medium text-xs leading-tight">
                        {row.setName}
                      </span>
                      <span className="text-zinc-500 text-[10px]">
                        {row.setId} · {row.series}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-center text-zinc-600 text-xs">
                    {row.totalCards}
                  </td>
                  {languages.map((lang) => {
                    if (lang.isDefault) {
                      return (
                        <td key={lang.code} className="px-1.5 py-1.5">
                          <Cell
                            status="complete"
                            count={row.totalCards}
                            nameCount={row.totalCards}
                            total={row.totalCards}
                          />
                        </td>
                      );
                    }
                    const cell = row.cells[lang.code];
                    if (!cell) {
                      return (
                        <td key={lang.code} className="px-1.5 py-1.5">
                          <Cell
                            status="nonexistent"
                            count={0}
                            nameCount={0}
                            total={row.totalCards}
                          />
                        </td>
                      );
                    }
                    return (
                      <td key={lang.code} className="px-1.5 py-1.5">
                        <Cell {...cell} />
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Cell ─────────────────────────────────────────────────────────────────────

function Cell({ status, count, nameCount, total }: CellData) {
  const styleKey = status;
  const style = STATUS_STYLES[styleKey];
  const border = STATUS_BORDER[styleKey];
  const label = STATUS_LABEL[status];

  if (status === "nonexistent") {
    return (
      <div
        className={`rounded h-8 flex items-center justify-center text-[10px] ${style} ${border}`}
        title={label}
      >
        —
      </div>
    );
  }

  if (status === "not_seeded") {
    return (
      <div
        className={`rounded h-8 flex items-center justify-center text-[10px] ${style} ${border}`}
        title={`${label}: 0 / ${total}`}
      >
        ?
      </div>
    );
  }

  const pct = total > 0 ? Math.floor((count / total) * 100) : 0;
  const namePct = total > 0 ? Math.floor((nameCount / total) * 100) : 0;

  const tooltipParts = [`${label}: ${count}/${total} images (${pct}%)`];
  if (nameCount !== total) {
    tooltipParts.push(`${nameCount}/${total} names (${namePct}%)`);
  }

  return (
    <div
      className={`rounded h-8 flex flex-col items-center justify-center ${style} ${border}`}
      title={tooltipParts.join(" · ")}
    >
      {status === "complete" ? (
        <span className="text-[11px] font-semibold">✓</span>
      ) : status === "missing_names" ? (
        // Both images AND names are incomplete — two columns: img left, names right
        <div className="flex flex-row items-center justify-center gap-1.5">
          <div className="flex flex-col items-center leading-none gap-0.5">
            <span className="text-[9px] font-semibold">{pct}%</span>
            <span className="text-[7px] opacity-60">
              {count}/{total}
            </span>
            <span className="text-[7px] opacity-60">image</span>
          </div>
          <div className="w-px h-4 bg-current opacity-20 self-center" />
          <div className="flex flex-col items-center leading-none gap-0.5">
            <span className="text-[9px] font-semibold">{namePct}%</span>
            <span className="text-[7px] opacity-60">
              {nameCount}/{total}
            </span>
            <span className="text-[7px] opacity-60">name</span>
          </div>
        </div>
      ) : (
        <>
          <span className="text-[10px] font-semibold leading-none">{pct}%</span>
          {status === "missing_images" && (
            <span className="text-[8px] opacity-60 leading-none mt-0.5">
              {count}/{total} img
            </span>
          )}
        </>
      )}
    </div>
  );
}
