// Scrape German card images from pokemonkarte.de and seed them into the
// localizations table.
//
// Strategy:
//   1. For each set in POKEMONKARTE_SETS, fetch the listing page(s) (paginated).
//   2. Parse all card detail page URLs and extract localId from the alt text
//      on those listing pages (format: "CardName - <localId> - SetName").
//   3. Cross-reference with still-missing.json – only fetch card detail pages
//      for cards that are still missing a German image.
//   4. On each card detail page, find the wp-content/uploads image URL.
//   5. Upsert image_small and image_large into localizations (lang = "de").
//   6. Re-write still-missing.json with resolved cards removed.
//
// Run: npx tsx scripts/seed-from-pokemonkarte-de.ts

import { config } from "dotenv";
config();

import * as fs from "fs";
import * as path from "path";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, sql } from "drizzle-orm";
import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// DB setup (mirrors scan-and-seed-pokewiki-sets.ts)
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not set in .env");
  process.exit(1);
}

const db = drizzle(DATABASE_URL);

const localizationsTable = pgTable("localizations", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  table_name: varchar("table_name", { length: 64 }).notNull(),
  column_name: varchar("column_name", { length: 64 }).notNull(),
  record_id: varchar("record_id", { length: 16 }).notNull(),
  language: varchar("language", { length: 8 }).notNull(),
  value: text("value").notNull(),
  created_at: timestamp("created_at", { mode: "string" })
    .notNull()
    .defaultNow(),
  updated_at: timestamp("updated_at", { mode: "string" })
    .notNull()
    .defaultNow(),
});

async function upsertLocalization(
  tableName: string,
  columnName: string,
  recordId: string,
  lang: string,
  value: string,
): Promise<void> {
  const existing = await db
    .select()
    .from(localizationsTable)
    .where(
      and(
        eq(localizationsTable.table_name, tableName),
        eq(localizationsTable.column_name, columnName),
        eq(localizationsTable.record_id, recordId),
        eq(localizationsTable.language, lang),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(localizationsTable)
      .set({ value, updated_at: sql`NOW()` })
      .where(eq(localizationsTable.id, existing[0].id));
  } else {
    await db.insert(localizationsTable).values({
      table_name: tableName,
      column_name: columnName,
      record_id: recordId,
      language: lang,
      value,
    });
  }
}

// ---------------------------------------------------------------------------
// Set → listing page URL mapping
// ---------------------------------------------------------------------------

const BASE = "https://www.pokemonkarte.de";

const POKEMONKARTE_SETS: Record<string, string> = {
  // ── Grundserie ────────────────────────────────────────────────────────────
  base1: `${BASE}/de/grundserie/grundset/`,
  base2: `${BASE}/de/grundserie/dschungel/`,
  base3: `${BASE}/de/grundserie/fossil-grundserie/`,
  base5: `${BASE}/de/grundserie/team-rocket-grundserie/`,
  neo1: `${BASE}/de/grundserie/neo-genesis-grundserie/`,
  neo2: `${BASE}/de/grundserie/neo-entdeckung/`,
  neo3: `${BASE}/de/grundserie/neo-revelation-grundserie/`,
  neo4: `${BASE}/de/grundserie/neo-destiny-grundserie/`,
  ecard1: `${BASE}/de/grundserie/expedition-grundserie/`,
  ecard2: `${BASE}/de/grundserie/aquapolis-grundserie/`,
  ecard3: `${BASE}/de/grundserie/skyridge-grundserie/`,

  // ── EX Zyklus ─────────────────────────────────────────────────────────────
  // IDs match the TCG API: ex9=Smaragd, ex10=Verborgene Mächte, ex11=Delta Species, …
  ex1: `${BASE}/de/ex-zyklus/rubin-saphir/`,
  ex2: `${BASE}/de/ex-zyklus/sandsturm/`,
  ex3: `${BASE}/de/ex-zyklus/drache/`,
  ex4: `${BASE}/de/ex-zyklus/team-magma-vs-team-aqua-ex-zyklus/`,
  ex6: `${BASE}/de/ex-zyklus/feuerrot-blattgrun/`,
  ex8: `${BASE}/de/ex-zyklus/deoxys-ex-zyklus/`,
  ex9: `${BASE}/de/ex-zyklus/smaragd/`,
  ex10: `${BASE}/de/ex-zyklus/verborgene-machte/`,
  ex11: `${BASE}/de/ex-zyklus/delta-species-ex-zyklus/`,
  ex12: `${BASE}/de/ex-zyklus/legend-maker-ex-zyklus/`,
  ex13: `${BASE}/de/ex-zyklus/holon-phantoms-ex-zyklus/`,
  ex14: `${BASE}/de/ex-zyklus/crystal-guardians-ex-zyklus/`,
  ex15: `${BASE}/de/ex-zyklus/dragon-frontiers-ex-zyklus/`,
  ex16: `${BASE}/de/ex-zyklus/power-keepers-ex-zyklus/`,

  // ── Diamant & Perl Zyklus ─────────────────────────────────────────────────
  dp1: `${BASE}/de/diamant-perl-zyklus/diamant-perl/`,
  dp2: `${BASE}/de/diamant-perl-zyklus/geheimnisvolle-schatze/`,
  dp3: `${BASE}/de/diamant-perl-zyklus/ratselhafte-wunder/`,
  dp4: `${BASE}/de/diamant-perl-zyklus/epische-begegnungen/`,
  dp5: `${BASE}/de/diamant-perl-zyklus/majestatischer-morgen/`,
  dp6: `${BASE}/de/diamant-perl-zyklus/erwachte-legenden/`,
  dp7: `${BASE}/de/diamant-perl-zyklus/sturmtief/`,
  dpp: `${BASE}/de/diamant-perl-zyklus/diamant-perl-promos/`,

  // ── Platin Zyklus ─────────────────────────────────────────────────────────
  pl1: `${BASE}/de/platin-zyklus/platin/`,
  pl2: `${BASE}/de/platin-zyklus/aufstieg-der-rivalen/`,
  pl3: `${BASE}/de/platin-zyklus/ultimative-sieger/`,
  pl4: `${BASE}/de/platin-zyklus/arceus-platin-zyklus/`,

  // ── HGSS Zyklus ───────────────────────────────────────────────────────────
  hgss1: `${BASE}/de/hgss-zyklus/hgss-de/`,
  hgss2: `${BASE}/de/hgss-zyklus/entfesselt/`,
  hgss3: `${BASE}/de/hgss-zyklus/unerschrocken/`,
  hgss4: `${BASE}/de/hgss-zyklus/triumph/`,
  hgssp: `${BASE}/de/hgss-zyklus/heartgold-soulsilver-promos-2/`,
  col1: `${BASE}/de/hgss-zyklus/ruf-der-legenden/`,

  // ── Schwarz & Weiss Zyklus ───────────────────────────────────────────────
  bwp: `${BASE}/de/schwarz-weiss-zyklus/schwarz-weiss-promos/`,

  // ── XY Zyklus ────────────────────────────────────────────────────────────
  xyp: `${BASE}/de/xy-zyklus/xy-promos-xy-zyklus/`,
  g1: `${BASE}/de/xy-zyklus/generationen/`,

  // ── Sonne & Mond Zyklus ──────────────────────────────────────────────────
  sm1: `${BASE}/de/sonne-mond-zyklus/sonne-mond/`,
  sm115: `${BASE}/de/sonne-mond-zyklus/verborgenes-schicksal/`,
  smp: `${BASE}/de/sonne-mond-zyklus/sun-moon-promos-sonne-mond-zyklus/`,

  // ── Schwert & Schild Zyklus ──────────────────────────────────────────────
  swshp: `${BASE}/de/schwert-schild-zyklus/schwert-schild-promos/`,

  // ── POP Serien (Promokarten) ───────────────────────────────────────────────
  pop1: `${BASE}/de/promokarten/pop-serie-1/`,
  pop2: `${BASE}/de/promokarten/pop-serie-2/`,
  pop3: `${BASE}/de/promokarten/pop-serie-3/`,
  pop4: `${BASE}/de/promokarten/pop-serie-4/`,
  pop5: `${BASE}/de/promokarten/pop-serie-5/`,
  pop6: `${BASE}/de/promokarten/pop-serie-6/`,
  pop7: `${BASE}/de/promokarten/pop-serie-7/`,
  pop8: `${BASE}/de/promokarten/pop-serie-8/`,
  pop9: `${BASE}/de/promokarten/pop-serie-9/`,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MissingCard {
  setId: string;
  setName: string;
  id: string;
  localId: string;
  englishName: string;
  germanName: string | null;
  hasGermanImage: boolean;
  germanImageUrl: string | null;
  pokewikiFilename: string | null;
  pokewikiUrl: string | null;
  status: string;
}

interface CardEntry {
  /** Relative URL path, e.g. "/karte/aerodactyl-1-fo-deutsch/" */
  cardPagePath: string;
  /** Parsed localId from alt text, e.g. "1", "H1", "PROMO" */
  localId: string;
  /** Whether the listing page showed a real image (not "Placeholder") */
  hasImage: boolean;
  /** Full-size image URL extracted from listing page (empty if no image) */
  imageUrl: string;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    console.error(`  ⚠️  fetch failed for ${url}: ${err}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Listing page parser
// ---------------------------------------------------------------------------

/**
 * Strip thumbnail size suffix from a WooCommerce image URL.
 * e.g. ".../Alakazam-Expedition-300x428.jpg" → ".../Alakazam-Expedition.jpg"
 */
function fullSizeUrl(url: string): string {
  return url.replace(/-\d+x\d+(\.(?:jpg|jpeg|png|webp))$/i, "$1");
}

/**
 * Convert a webp-express URL back to the original wp-content/uploads jpg.
 * e.g. ".../webp-express/webp-images/uploads/Foo-300x400.jpg.webp"
 *   → ".../wp-content/uploads/Foo.jpg"
 */
function webpExpressToJpg(url: string): string {
  return fullSizeUrl(
    url
      .replace(
        "/wp-content/webp-express/webp-images/uploads/",
        "/wp-content/uploads/",
      )
      .replace(/\.webp$/i, ""),
  );
}

/**
 * Extract all card entries from ONE listing page HTML.
 *
 * WooCommerce product links use class="woocommerce-loop-product__link" and
 * contain an <img alt="CardName - LocalId - SetName" src="thumbnail-url">.
 * Images with alt="Placeholder" or missing "Set Symbol" mean no image.
 *
 * Returns array of { cardPagePath, localId, hasImage, imageUrl }.
 */
function parseListingPage(html: string): CardEntry[] {
  const entries: CardEntry[] = [];
  const seen = new Set<string>();

  // Match WooCommerce product links (href BEFORE class in the HTML)
  // Pattern: href="https://...karte/...-deutsch/" class="woocommerce-LoopProduct-link..."
  const linkRe =
    /href="(https:\/\/www\.pokemonkarte\.de\/karte\/[^"]*?-deutsch\/)[^>]*class="woocommerce-LoopProduct-link/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRe.exec(html)) !== null) {
    const fullUrl = match[1]!;
    const cardPagePath = fullUrl.replace(BASE, "");

    if (seen.has(cardPagePath)) continue;
    seen.add(cardPagePath);

    // Scan the HTML block after this link (up to ~2000 chars) for the img
    const afterLink = html.slice(match.index!, match.index! + 2000);

    // ── Alt text ────────────────────────────────────────────────────────────
    // The <img> inside the product anchor always has alt="CardName - N - Set"
    const altExec = /alt="([^"]*)"/.exec(afterLink);
    if (!altExec) continue;
    const altText = altExec[1]!.trim();
    const hasImage =
      altText !== "Placeholder" && altText !== "Set Symbol" && altText !== "";

    // ── Image URL ────────────────────────────────────────────────────────────
    // Strategy A: eager-loaded img has a real src= pointing to wp-content/uploads
    // Strategy B: lazy-loaded img has src="data:..." but <source data-lazy-srcset="...">
    let rawImgUrl = "";

    // Try strategy A first
    const srcMatch =
      /src="(https:\/\/www\.pokemonkarte\.de\/wp-content\/uploads\/[^"]+)"/i.exec(
        afterLink,
      );
    if (srcMatch) {
      rawImgUrl = srcMatch[1]!;
    } else if (hasImage) {
      // Strategy B: extract first URL from data-lazy-srcset on <source>
      const lazyMatch =
        /data-lazy-srcset="(https:\/\/www\.pokemonkarte\.de\/wp-content\/webp-express\/[^\s"]+)/i.exec(
          afterLink,
        );
      if (lazyMatch) {
        rawImgUrl = webpExpressToJpg(lazyMatch[1]!);
      }
    }

    if (!rawImgUrl && hasImage) continue; // no image URL found at all

    // Parse localId from alt text: "CardName - <localId> - SetDisplayName"
    const parts = altText.split(" - ");
    let localId: string;
    if (parts.length >= 3) {
      localId = parts[1]!.trim().toUpperCase();
    } else {
      // Fallback: extract from URL slug /karte/{name}-{localId}-{setcode}-deutsch/
      // e.g. /karte/turtwig-dp01-dpp-deutsch/ → localId = "dp01" → "DP01"
      const slugMatch = /\/karte\/[^/]+-(\w+)-[^-]+-deutsch\/$/.exec(
        cardPagePath,
      );
      localId = slugMatch ? slugMatch[1]!.toUpperCase() : "";
    }

    if (!localId) continue;

    const imageUrl = hasImage ? fullSizeUrl(rawImgUrl) : "";

    entries.push({ cardPagePath, localId, hasImage, imageUrl });
  }

  return entries;
}

/**
 * Fetch all pages of a set listing and return all card entries.
 * Stops when a page returns no card entries or 404.
 */
async function fetchAllListingEntries(baseUrl: string): Promise<CardEntry[]> {
  const all: CardEntry[] = [];
  let page = 1;

  while (true) {
    const url = page === 1 ? baseUrl : `${baseUrl}page/${page}/`;
    const html = await fetchHtml(url);

    if (!html) break;

    const entries = parseListingPage(html);
    if (entries.length === 0) break;

    all.push(...entries);

    const hasNext = html.includes(`page/${page + 1}/`);
    if (!hasNext) break;

    page++;
    await sleep(400);
  }

  return all;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Safety check for non-local DB
  const dbHost =
    DATABASE_URL!.split("@")[1]?.split("/")[0]?.split(":")[0] ?? "unknown";
  const dbUser = DATABASE_URL!.split("//")[1]?.split(":")?.[0] ?? "unknown";

  if (dbHost !== "localhost") {
    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await new Promise<string>((resolve) => {
      rl.question(
        `⚠️  Non-local database: ${dbUser}@${dbHost}\nProceed? (y/N): `,
        (a) => {
          rl.close();
          resolve(a);
        },
      );
    });
    if (answer.toLowerCase() !== "y") {
      console.log("❌ Cancelled.");
      process.exit(0);
    }
  }

  // Load still-missing.json
  const missingPath = path.join(process.cwd(), "public", "still-missing.json");
  const allMissing: MissingCard[] = JSON.parse(
    fs.readFileSync(missingPath, "utf-8"),
  ) as MissingCard[];

  // Build lookup: setId → localId → card
  const missingBySet = new Map<string, Map<string, MissingCard>>();
  for (const card of allMissing) {
    if (!missingBySet.has(card.setId)) missingBySet.set(card.setId, new Map());
    missingBySet.get(card.setId)!.set(card.localId, card);
  }

  // Determine which sets to process (only those with missing cards on the site)
  const setsToProcess = Object.keys(POKEMONKARTE_SETS).filter((setId) =>
    missingBySet.has(setId),
  );

  const totalMissingInScope = setsToProcess.reduce(
    (n, s) => n + (missingBySet.get(s)?.size ?? 0),
    0,
  );

  console.log(`\n🇩🇪  pokemonkarte.de image scraper`);
  console.log(`   ${setsToProcess.length} sets to scan`);
  console.log(`   ${totalMissingInScope} cards still missing in those sets\n`);

  const resolvedIds = new Set<string>();
  let totalSeeded = 0;
  let totalErrors = 0;
  const LANG = "de";

  for (const setId of setsToProcess) {
    const listingUrl = POKEMONKARTE_SETS[setId]!;
    const missingForSet = missingBySet.get(setId)!;
    const setSize = missingForSet.size;

    process.stdout.write(
      `\n  📂 ${setId.padEnd(8)} (${setSize} missing) — fetching listing…`,
    );

    const entries = await fetchAllListingEntries(listingUrl);

    if (entries.length === 0) {
      console.log(`  ⚠️  no entries found, skipping`);
      continue;
    }

    // Filter to entries whose localId is in our missing list AND have an image
    const toSeed = entries.filter(
      (e) => missingForSet.has(e.localId) && e.hasImage && e.imageUrl,
    );

    const noImageCount = entries.filter(
      (e) => missingForSet.has(e.localId) && !e.hasImage,
    ).length;

    console.log(
      `\r  📂 ${setId.padEnd(8)} ${entries.length} listed, ${toSeed.length} to seed` +
        (noImageCount > 0 ? `, ${noImageCount} placeholder (skipped)` : ""),
    );

    if (toSeed.length === 0) continue;

    let setSeeded = 0;
    let setErrors = 0;

    for (const entry of toSeed) {
      const card = missingForSet.get(entry.localId)!;

      try {
        await upsertLocalization(
          "cards",
          "image_small",
          card.id,
          LANG,
          entry.imageUrl,
        );
        await upsertLocalization(
          "cards",
          "image_large",
          card.id,
          LANG,
          entry.imageUrl,
        );
        resolvedIds.add(card.id);
        setSeeded++;
        totalSeeded++;
        process.stdout.write("✓");
      } catch (err) {
        console.error(`\n  ❌ DB error for ${card.id}: ${err}`);
        setErrors++;
        totalErrors++;
      }
    }

    const icon =
      setSeeded === toSeed.length ? "✅" : setSeeded > 0 ? "🟡" : "❌";
    console.log(
      `\n  ${icon} ${setId.padEnd(8)} seeded ${setSeeded}/${toSeed.length}${setErrors ? `, ${setErrors} errors` : ""}`,
    );

    await sleep(300);
  }

  // Update still-missing.json
  const remaining = allMissing.filter((c) => !resolvedIds.has(c.id));
  fs.writeFileSync(missingPath, JSON.stringify(remaining, null, 2) + "\n");

  console.log(`\n========= DONE =========`);
  console.log(`✅ Seeded:    ${totalSeeded} cards`);
  if (totalErrors > 0) console.log(`❌ Errors:    ${totalErrors}`);
  console.log(
    `⏳ Remaining: ${remaining.length} / ${allMissing.length} cards in still-missing.json`,
  );
  console.log();
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
