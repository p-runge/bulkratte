/**
 * scan-symbol-positions.ts
 *
 * Downloads 3 sample card images from every non-Pocket set and finds the
 * exact bounding box of the set symbol in the bottom strip.
 *
 * Strategy: scan from the RIGHT edge inward using column-gap detection.
 * The symbol is the rightmost dark cluster in the info strip (the number
 * sits on the left, the symbol on the right).
 *
 * Output: /tmp/symbol-positions.json  +  /tmp/symbol-crops/<setId>-<n>.webp
 *
 * Run:
 *   pnpm tsx --tsconfig tsconfig.scripts.json scripts/db/scan-symbol-positions.ts
 */

import TCGdex from "@tcgdex/sdk";
import sharp from "sharp";
import fs from "fs";
import path from "path";

// ── Tuning ────────────────────────────────────────────────────────────────
/** Start inspecting the card from this Y fraction downward. */
const STRIP_START_FRAC = 0.9;
/** Thresholds to try (darkest first — stops at first usable result). */
const DARK_THRESHOLDS = [60, 80, 100, 128];
/** Consecutive empty columns that signal the end of the symbol cluster. */
const GAP_COLS = 6;
/** Symbol is never to the left of this X fraction. */
const MIN_SYMBOL_X_FRAC = 0.4;
/** How many cards to sample per set (indices spread through the set). */
const SAMPLES_PER_SET = 3;
const OUT_DIR = "/tmp/symbol-crops";

// ── Types ─────────────────────────────────────────────────────────────────
interface Bounds {
  x1: number; // fraction of card width
  x2: number;
  y1: number; // fraction of card height
  y2: number;
  threshold: number;
}

interface SetResult {
  setId: string;
  seriesName: string;
  setName: string;
  cards: Array<{
    cardId: string;
    imageUrl: string;
    bounds: Bounds | null;
    error?: string;
  }>;
  consensus: Bounds | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────
async function fetchBuf(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Detect the set-symbol bounding box by scanning columns right→left.
 * The symbol is the rightmost significant dark cluster in the info strip.
 */
function detectSymbol(
  raw: Buffer,
  width: number,
  stripH: number,
  stripTop: number,
  cardHeight: number,
  threshold: number,
): Bounds | null {
  const minCol = Math.round(width * MIN_SYMBOL_X_FRAC);

  // Count dark pixels per column
  const colDark = new Array(width).fill(0);
  for (let r = 0; r < stripH; r++)
    for (let c = minCol; c < width; c++)
      if (raw[r * width + c]! < threshold) colDark[c]++;

  // Find the rightmost dark column
  let last = -1;
  for (let c = width - 1; c >= minCol; c--)
    if (colDark[c] >= 1) {
      last = c;
      break;
    }
  if (last < 0) return null;

  // Walk left from `last` until GAP_COLS consecutive empty columns
  let symLeft = last;
  let gap = 0;
  for (let c = last; c >= minCol; c--) {
    if (colDark[c] >= 1) {
      symLeft = c;
      gap = 0;
    } else if (++gap >= GAP_COLS) break;
  }

  // Row bounds within the detected column range
  let rowMin = stripH,
    rowMax = -1;
  for (let r = 0; r < stripH; r++)
    for (let c = symLeft; c <= last; c++)
      if (raw[r * width + c]! < threshold) {
        if (r < rowMin) rowMin = r;
        if (r > rowMax) rowMax = r;
      }

  if (rowMax < 0) return null;

  const symW = last - symLeft + 1;
  const symH = rowMax - rowMin + 1;
  // Reject noise: must be at least 4px wide and tall, and roughly square-ish
  if (symW < 4 || symH < 4) return null;
  // A symbol should be roughly square — reject if wildly lopsided
  const aspect = symW / symH;
  if (aspect > 8 || aspect < 0.15) return null;

  return {
    x1: symLeft / width,
    x2: last / width,
    y1: (stripTop + rowMin) / cardHeight,
    y2: (stripTop + rowMax) / cardHeight,
    threshold,
  };
}

async function analyzeCard(
  imageUrl: string,
  cardId: string,
  setId: string,
  sampleIndex: number,
): Promise<Bounds | null> {
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

  // Save the strip crop for visual inspection
  const cropPath = path.join(OUT_DIR, `${setId}-${sampleIndex}.webp`);
  await sharp(buf)
    .extract({ left: 0, top: stripTop, width, height: stripH })
    .toFile(cropPath);

  for (const t of DARK_THRESHOLDS) {
    const b = detectSymbol(raw, width, stripH, stripTop, height, t);
    if (b) return b;
  }
  return null;
}

function median(vals: number[]): number {
  if (vals.length === 0) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function consensusBounds(
  cards: Array<{ bounds: Bounds | null }>,
): Bounds | null {
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

  console.log("Fetching series list from TCGdex…");
  const allSeries = await sdk.serie.list();
  const series = allSeries.filter(
    (s) => !s.name.includes("Pocket") && s.id !== "tcgp",
  );
  console.log(`Processing ${series.length} series.`);

  const results: SetResult[] = [];

  for (const serieStub of series) {
    let serieFull: Awaited<ReturnType<typeof sdk.serie.get>>;
    try {
      serieFull = await sdk.serie.get(serieStub.id);
    } catch (e) {
      console.warn(`  ⚠ ${serieStub.id}: ${(e as Error).message}`);
      continue;
    }
    if (!serieFull?.sets?.length) continue;

    for (const setStub of serieFull.sets) {
      const setId = setStub.id;
      console.log(`  ${setId} (${serieStub.name})`);

      let setFull: Awaited<ReturnType<typeof sdk.set.get>>;
      try {
        setFull = await sdk.set.get(setId);
      } catch (e) {
        console.warn(`    ⚠ ${setId}: ${(e as Error).message}`);
        continue;
      }
      if (!setFull?.cards?.length) continue;

      const cards = setFull.cards;
      const total = cards.length;

      // Pick SAMPLES_PER_SET cards spread across the middle of the set
      const pickFracs =
        SAMPLES_PER_SET === 3
          ? [0.25, 0.5, 0.75]
          : SAMPLES_PER_SET === 2
            ? [0.3, 0.7]
            : [0.5];
      const picks = pickFracs
        .map((f) =>
          Math.max(0, Math.min(total - 1, Math.round((total - 1) * f))),
        )
        .filter((v, i, a) => a.indexOf(v) === i); // deduplicate

      const setResult: SetResult = {
        setId,
        seriesName: serieStub.name,
        setName: setStub.name,
        cards: [],
        consensus: null,
      };

      for (let i = 0; i < picks.length; i++) {
        const card = cards[picks[i]!];
        if (!card) continue;
        const imageUrl = card.image ? `${card.image}/high.webp` : null;
        if (!imageUrl) {
          setResult.cards.push({
            cardId: card.id,
            imageUrl: "",
            bounds: null,
            error: "no image",
          });
          continue;
        }
        try {
          const bounds = await analyzeCard(imageUrl, card.id, setId, i + 1);
          if (bounds) {
            console.log(
              `    [${i + 1}] ${card.id}: x=[${bounds.x1.toFixed(3)}–${bounds.x2.toFixed(3)}] y=[${bounds.y1.toFixed(3)}–${bounds.y2.toFixed(3)}] (t=${bounds.threshold})`,
            );
          } else {
            console.log(`    [${i + 1}] ${card.id}: no symbol found`);
          }
          setResult.cards.push({ cardId: card.id, imageUrl, bounds });
        } catch (e) {
          const msg = (e as Error).message;
          console.warn(`    ✗ ${card.id}: ${msg}`);
          setResult.cards.push({
            cardId: card.id,
            imageUrl,
            bounds: null,
            error: msg,
          });
        }
      }

      setResult.consensus = consensusBounds(setResult.cards);
      if (setResult.consensus) {
        const c = setResult.consensus;
        console.log(
          `  → consensus x=[${c.x1.toFixed(3)}–${c.x2.toFixed(3)}] y=[${c.y1.toFixed(3)}–${c.y2.toFixed(3)}]`,
        );
      }
      results.push(setResult);
    }
  }

  const reportPath = "/tmp/symbol-positions.json";
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Report written to ${reportPath}`);

  // ── Print summary sorted by x1 (left edge of symbol) ──────────────────
  console.log("\n── Summary (sorted by x1) ──");
  const valid = results.filter((r) => r.consensus !== null);
  valid
    .sort((a, b) => a.consensus!.x1 - b.consensus!.x1)
    .forEach((r) => {
      const c = r.consensus!;
      console.log(
        `${r.setId.padEnd(14)} ${r.seriesName.padEnd(26)} ` +
          `x=[${c.x1.toFixed(3)}–${c.x2.toFixed(3)}] ` +
          `y=[${c.y1.toFixed(3)}–${c.y2.toFixed(3)}]`,
      );
    });

  console.log(
    `\nTotal: ${results.length} sets, ${valid.length} with symbol detected.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
