/**
 * scan-set-positions.ts
 *
 * Downloads 2 sample card images from every non-Pocket set, finds the exact
 * bounding box of the card number in the bottom strip, and emits a JSON report.
 *
 * Output: /tmp/set-positions.json  +  /tmp/set-crops/<setId>-<card>.webp
 *
 * Run:
 *   pnpm tsx --tsconfig tsconfig.scripts.json scripts/db/scan-set-positions.ts
 */

import TCGdex from "@tcgdex/sdk";
import sharp from "sharp";
import fs from "fs";
import path from "path";

// ── Tuning ────────────────────────────────────────────────────────────────
const STRIP_START_FRAC = 0.91; // start looking for the info strip here
const DARK_THRESHOLDS = [60, 80, 100, 128]; // brightest pixel still = "dark"
const GAP_COLS = 8; // consecutive empty columns = end of number text
const MAX_NUM_X_FRAC = 0.55; // number never reaches past 55% of card width
const OUT_DIR = "/tmp/set-crops";

// ── Types ─────────────────────────────────────────────────────────────────
interface NumberBounds {
  x1: number; // fraction of card width
  x2: number;
  y1: number; // fraction of card height
  y2: number;
  threshold: number; // which DARK_THRESHOLD found the number
}

interface SetResult {
  setId: string;
  seriesName: string;
  setName: string;
  cards: Array<{
    cardId: string;
    imageUrl: string;
    bounds: NumberBounds | null;
    error?: string;
  }>;
  /** Consensus bounds across the samples (median of card bounds). */
  consensus: NumberBounds | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────
async function fetchBuf(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * For the given grayscale raw buffer (width×stripH), run column-gap detection
 * with <threshold> to find the card number bounding box.
 * Returns null if no plausible number region is found.
 */
function detectNumber(
  raw: Buffer,
  width: number,
  stripH: number,
  stripTop: number,
  cardHeight: number,
  threshold: number,
): NumberBounds | null {
  // Column dark-pixel counts
  const colDark = new Array(width).fill(0);
  for (let r = 0; r < stripH; r++)
    for (let c = 0; c < width; c++)
      if (raw[r * width + c]! < threshold) colDark[c]++;

  // First dark column
  let first = -1;
  for (let c = 0; c < width; c++)
    if (colDark[c] >= 1) {
      first = c;
      break;
    }
  if (first < 0) return null;

  // Walk right until GAP_COLS consecutive empty columns
  let numRight = first;
  let gap = 0;
  for (let c = first; c < Math.round(width * MAX_NUM_X_FRAC); c++) {
    if (colDark[c] >= 1) {
      numRight = c;
      gap = 0;
    } else if (++gap >= GAP_COLS) break;
  }

  // Row bounds within that column range
  let rowMin = stripH,
    rowMax = -1;
  for (let r = 0; r < stripH; r++)
    for (let c = first; c <= numRight; c++)
      if (raw[r * width + c]! < threshold) {
        if (r < rowMin) rowMin = r;
        if (r > rowMax) rowMax = r;
      }

  if (rowMax < 0) return null;

  // Reject implausibly small spans (noise) or suspicious widths hitting limit
  const numW = numRight - first + 1;
  const numH = rowMax - rowMin + 1;
  if (numW < 4 || numH < 2) return null;

  return {
    x1: first / width,
    x2: numRight / width,
    y1: (stripTop + rowMin) / cardHeight,
    y2: (stripTop + rowMax) / cardHeight,
    threshold,
  };
}

/** Pick the best NumberBounds across all thresholds tried, favouring smaller
 *  extent (= more precise text-only bbox) from a "good" threshold range. */
async function analyzeCard(
  imageUrl: string,
  cardId: string,
  setId: string,
): Promise<NumberBounds | null> {
  const buf = await fetchBuf(imageUrl);
  const meta = await sharp(buf).metadata();
  const width = meta.width!;
  const height = meta.height!;

  const stripTop = Math.round(height * STRIP_START_FRAC);
  const stripH = height - stripTop;
  const raw = await sharp(buf)
    .extract({ left: 0, top: stripTop, width, height: stripH })
    .grayscale()
    .raw()
    .toBuffer();

  // Save crop for visual inspection
  const cropPath = path.join(OUT_DIR, `${setId}-${cardId}.webp`);
  await sharp(buf)
    .extract({ left: 0, top: stripTop, width, height: stripH })
    .toFile(cropPath);

  // Try each dark threshold; pick first that gives reasonable bounds
  for (const t of DARK_THRESHOLDS) {
    const b = detectNumber(raw, width, stripH, stripTop, height, t);
    if (b) return b;
  }
  return null;
}

/** Median of an array of numbers. */
function median(vals: number[]): number {
  if (vals.length === 0) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Consensus bounds: median of all valid card bounds in the set. */
function consensus(
  cards: Array<{ bounds: NumberBounds | null }>,
): NumberBounds | null {
  const valid = cards.filter((c) => c.bounds !== null).map((c) => c.bounds!);
  if (valid.length === 0) return null;
  return {
    x1: median(valid.map((b) => b.x1)),
    x2: median(valid.map((b) => b.x2)),
    y1: median(valid.map((b) => b.y1)),
    y2: median(valid.map((b) => b.y2)),
    threshold: median(valid.map((b) => b.threshold)),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const sdk = new TCGdex("en");

  console.log("Fetching all series from TCGdex…");
  const allSeries = await sdk.serie.list();

  // Filter out Pocket
  const series = allSeries.filter(
    (s) => !s.name.includes("Pocket") && s.id !== "tcgp",
  );
  console.log(`Processing ${series.length} non-Pocket series.`);

  const results: SetResult[] = [];

  for (const serieStub of series) {
    console.log(`\n── Series: ${serieStub.name} (${serieStub.id}) ──`);

    let serieFull: Awaited<ReturnType<typeof sdk.serie.get>>;
    try {
      serieFull = await sdk.serie.get(serieStub.id);
    } catch (e) {
      console.warn(
        `  ⚠ Could not fetch series ${serieStub.id}: ${(e as Error).message}`,
      );
      continue;
    }

    if (!serieFull?.sets || serieFull.sets.length === 0) {
      console.log("  (no sets)");
      continue;
    }

    // Process every set in the series (not just one)
    for (const setStub of serieFull.sets) {
      const setId = setStub.id;
      const setName = setStub.name;
      console.log(`  Set: ${setName} (${setId})`);

      let setFull: Awaited<ReturnType<typeof sdk.set.get>>;
      try {
        setFull = await sdk.set.get(setId);
      } catch (e) {
        console.warn(
          `    ⚠ Could not fetch set ${setId}: ${(e as Error).message}`,
        );
        continue;
      }

      if (!setFull?.cards || setFull.cards.length === 0) {
        console.log("    (no cards)");
        continue;
      }

      // Sample: pick 2 non-promo cards from the middle octile
      const cards = setFull.cards;
      const total = cards.length;
      // Pick indices spread across the middle of the set (avoid first/last 10%)
      const indices = new Set<number>();
      const lo = Math.round(total * 0.2);
      const hi = Math.round(total * 0.8);
      indices.add(Math.round(total * 0.35));
      indices.add(Math.round(total * 0.65));
      // Clamp to valid range
      const picks = [...indices]
        .map((i) => Math.max(lo, Math.min(hi, i)))
        .slice(0, 2);

      const setResult: SetResult = {
        setId,
        seriesName: serieStub.name,
        setName,
        cards: [],
        consensus: null,
      };

      for (const idx of picks) {
        const card = cards[idx];
        if (!card) continue;

        // Build image URL: TCGdex image is {card.image}/high.webp
        const imageUrl = card.image ? `${card.image}/high.webp` : null;

        if (!imageUrl) {
          console.log(`      ${card.id}: no image URL`);
          setResult.cards.push({
            cardId: card.id,
            imageUrl: "",
            bounds: null,
            error: "no image",
          });
          continue;
        }

        try {
          console.log(`      Analyzing ${card.id}…`);
          const bounds = await analyzeCard(imageUrl, card.id, setId);
          console.log(
            bounds
              ? `        → x=[${bounds.x1.toFixed(3)}–${bounds.x2.toFixed(3)}] y=[${bounds.y1.toFixed(3)}–${bounds.y2.toFixed(3)}] (t=${bounds.threshold})`
              : "        → no number found",
          );
          setResult.cards.push({ cardId: card.id, imageUrl, bounds });
        } catch (e) {
          const msg = (e as Error).message;
          console.warn(`      ✗ ${card.id}: ${msg}`);
          setResult.cards.push({
            cardId: card.id,
            imageUrl,
            bounds: null,
            error: msg,
          });
        }
      }

      setResult.consensus = consensus(setResult.cards);
      if (setResult.consensus) {
        const c = setResult.consensus;
        console.log(
          `    Consensus: x=[${c.x1.toFixed(3)}–${c.x2.toFixed(3)}] y=[${c.y1.toFixed(3)}–${c.y2.toFixed(3)}]`,
        );
      }

      results.push(setResult);
    }
  }

  // Save full JSON report
  const reportPath = "/tmp/set-positions.json";
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Report written to ${reportPath}`);

  // Print summary table sorted by y1 (strip position)
  console.log("\n── Summary (sorted by y1) ──");
  const valid = results.filter((r) => r.consensus !== null);
  valid
    .sort((a, b) => a.consensus!.y1 - b.consensus!.y1)
    .forEach((r) => {
      const c = r.consensus!;
      console.log(
        `${r.setId.padEnd(12)} ${r.seriesName.padEnd(25)} ` +
          `x=[${c.x1.toFixed(3)}–${c.x2.toFixed(3)}] ` +
          `y=[${c.y1.toFixed(3)}–${c.y2.toFixed(3)}]`,
      );
    });

  console.log(
    `\nTotal: ${results.length} sets processed, ${valid.length} with number position detected.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
