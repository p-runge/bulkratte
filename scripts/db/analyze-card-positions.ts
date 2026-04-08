/**
 * Finds the EXACT pixel positions of the card number across every set era.
 * Uses 3 cards per era to account for card-to-card variation.
 * Outputs fractional coordinates (0-1) ready to paste into NUMBER_REGIONS.
 *
 * Run with:
 *   pnpm tsx --tsconfig tsconfig.scripts.json scripts/db/analyze-card-positions.ts
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";

// 3 representative cards per era — different slot numbers catch variation
// in number width (short "1/9" vs long "TG30/TG30").
const SAMPLES: { era: string; urls: string[] }[] = [
  {
    era: "Scarlet & Violet (SV)",
    urls: [
      "https://assets.tcgdex.net/en/sv/sv01/154/high.webp", // 154/198
      "https://assets.tcgdex.net/en/sv/sv01/1/high.webp", // 1/198
      "https://assets.tcgdex.net/en/sv/sv02/182/high.webp", // 182/197
    ],
  },
  {
    era: "Sword & Shield (SWSH)",
    urls: [
      "https://assets.tcgdex.net/en/swsh/swsh1/202/high.webp",
      "https://assets.tcgdex.net/en/swsh/swsh1/1/high.webp",
      "https://assets.tcgdex.net/en/swsh/swsh2/192/high.webp",
    ],
  },
  {
    era: "Sun & Moon (SM)",
    urls: [
      "https://assets.tcgdex.net/en/sm/sm1/149/high.webp",
      "https://assets.tcgdex.net/en/sm/sm1/1/high.webp",
      "https://assets.tcgdex.net/en/sm/sm2/145/high.webp",
    ],
  },
  {
    era: "XY",
    urls: [
      "https://assets.tcgdex.net/en/xy/xy1/146/high.webp",
      "https://assets.tcgdex.net/en/xy/xy1/1/high.webp",
      "https://assets.tcgdex.net/en/xy/xy2/162/high.webp",
    ],
  },
  {
    era: "Black & White (BW)",
    urls: [
      "https://assets.tcgdex.net/en/bw/bw1/114/high.webp",
      "https://assets.tcgdex.net/en/bw/bw1/34/high.webp",
      "https://assets.tcgdex.net/en/bw/bw2/99/high.webp",
    ],
  },
  {
    era: "HeartGold SoulSilver (HGSS)",
    urls: [
      "https://assets.tcgdex.net/en/hgss/hgss1/123/high.webp",
      "https://assets.tcgdex.net/en/hgss/hgss1/2/high.webp",
      "https://assets.tcgdex.net/en/hgss/hgss2/95/high.webp",
    ],
  },
  {
    era: "Platinum (PL)",
    urls: [
      "https://assets.tcgdex.net/en/pl/pl1/127/high.webp",
      "https://assets.tcgdex.net/en/pl/pl1/1/high.webp",
      "https://assets.tcgdex.net/en/pl/pl2/111/high.webp",
    ],
  },
  {
    era: "Diamond & Pearl (DP)",
    urls: [
      "https://assets.tcgdex.net/en/dp/dp1/130/high.webp",
      "https://assets.tcgdex.net/en/dp/dp1/1/high.webp",
      "https://assets.tcgdex.net/en/dp/dp2/100/high.webp",
    ],
  },
  {
    era: "EX",
    urls: [
      "https://assets.tcgdex.net/en/ex/ex1/109/high.webp",
      "https://assets.tcgdex.net/en/ex/ex1/71/high.webp",
      "https://assets.tcgdex.net/en/ex/ex2/97/high.webp",
    ],
  },
  {
    era: "Base / Jungle / Fossil",
    urls: [
      "https://assets.tcgdex.net/en/base/base1/102/high.webp",
      "https://assets.tcgdex.net/en/base/base1/69/high.webp",
      "https://assets.tcgdex.net/en/base/base2/130/high.webp",
    ],
  },
  {
    era: "Gym",
    urls: [
      "https://assets.tcgdex.net/en/gym/gym1/132/high.webp",
      "https://assets.tcgdex.net/en/gym/gym1/1/high.webp",
      "https://assets.tcgdex.net/en/gym/gym2/132/high.webp",
    ],
  },
  {
    era: "Neo",
    urls: [
      "https://assets.tcgdex.net/en/neo/neo1/111/high.webp",
      "https://assets.tcgdex.net/en/neo/neo1/20/high.webp",
      "https://assets.tcgdex.net/en/neo/neo2/75/high.webp",
    ],
  },
];

const DARK_THRESHOLD = 100; // pixel value < this = "dark" (text)
const OUT_DIR = "/tmp/card-positions";

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

interface Bounds {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  xFrac1: number;
  xFrac2: number;
  yFrac1: number;
  yFrac2: number;
}

/**
 * Scan the bottom 8% of the card.
 * Divide it into LEFT half (x < 50%) and RIGHT half (x > 50%).
 * Find the bounding box of dark pixels in each half.
 * The left cluster = card number (standard layout).
 * The right cluster = card number on Full Art / reversed layouts, OR set symbol.
 */
async function analyzeCard(
  url: string,
  cardWidth: number,
  cardHeight: number,
  rawBuf: Buffer,
): Promise<{ left: Bounds | null; right: Bounds | null }> {
  const searchTop = Math.round(cardHeight * 0.92);
  const searchH = cardHeight - searchTop;
  const midX = Math.round(cardWidth * 0.5);

  let lx1 = cardWidth,
    lx2 = 0,
    ly1 = cardHeight,
    ly2 = 0,
    lFound = false;
  let rx1 = cardWidth,
    rx2 = 0,
    ry1 = cardHeight,
    ry2 = 0,
    rFound = false;

  for (let row = searchTop; row < cardHeight; row++) {
    for (let col = 0; col < cardWidth; col++) {
      const px = rawBuf[row * cardWidth + col]!;
      if (px >= DARK_THRESHOLD) continue; // not dark

      const absRow = row;
      if (col < midX) {
        if (col < lx1) lx1 = col;
        if (col > lx2) lx2 = col;
        if (absRow < ly1) ly1 = absRow;
        if (absRow > ly2) ly2 = absRow;
        lFound = true;
      } else {
        if (col < rx1) rx1 = col;
        if (col > rx2) rx2 = col;
        if (absRow < ry1) ry1 = absRow;
        if (absRow > ry2) ry2 = absRow;
        rFound = true;
      }
    }
  }

  return {
    left: lFound
      ? {
          x1: lx1,
          x2: lx2,
          y1: ly1,
          y2: ly2,
          xFrac1: lx1 / cardWidth,
          xFrac2: lx2 / cardWidth,
          yFrac1: ly1 / cardHeight,
          yFrac2: ly2 / cardHeight,
        }
      : null,
    right: rFound
      ? {
          x1: rx1,
          x2: rx2,
          y1: ry1,
          y2: ry2,
          xFrac1: rx1 / cardWidth,
          xFrac2: rx2 / cardWidth,
          yFrac1: ry1 / cardHeight,
          yFrac2: ry2 / cardHeight,
        }
      : null,
  };
}

interface EraResult {
  era: string;
  left: { yFrac1: number[]; yFrac2: number[]; xFrac2: number[] };
  right: { yFrac1: number[]; xFrac1: number[]; xFrac2: number[] };
  errors: string[];
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const results: EraResult[] = [];

  for (const sample of SAMPLES) {
    console.log(`\n${sample.era}`);
    const result: EraResult = {
      era: sample.era,
      left: { yFrac1: [], yFrac2: [], xFrac2: [] },
      right: { yFrac1: [], xFrac1: [], xFrac2: [] },
      errors: [],
    };

    for (const url of sample.urls) {
      const buf = await fetchImage(url);
      if (!buf) {
        result.errors.push(`SKIP ${url}`);
        continue;
      }

      const { width, height } = await sharp(buf).metadata();
      if (!width || !height) {
        result.errors.push(`NO META ${url}`);
        continue;
      }

      // Decode to grayscale raw pixels
      const rawBuf = await sharp(buf).grayscale().raw().toBuffer();

      const { left, right } = await analyzeCard(url, width, height, rawBuf);

      // Save annotated crops for visual double-check
      const slug = url.split("/").slice(-4, -1).join("-");
      if (left) {
        const pad = 4;
        await sharp(buf)
          .extract({
            left: Math.max(0, left.x1 - pad),
            top: Math.max(0, left.y1 - pad),
            width: Math.min(
              width - Math.max(0, left.x1 - pad),
              left.x2 - left.x1 + pad * 2,
            ),
            height: Math.min(
              height - Math.max(0, left.y1 - pad),
              left.y2 - left.y1 + pad * 2,
            ),
          })
          .png()
          .toFile(path.join(OUT_DIR, `${slug}-left.png`));

        result.left.yFrac1.push(left.yFrac1);
        result.left.yFrac2.push(left.yFrac2);
        result.left.xFrac2.push(left.xFrac2);

        console.log(
          `  L  x=[${left.xFrac1.toFixed(3)}–${left.xFrac2.toFixed(3)}]  y=[${left.yFrac1.toFixed(3)}–${left.yFrac2.toFixed(3)}]  (${left.x2 - left.x1 + 1}×${left.y2 - left.y1 + 1}px)  ${url.split("/").slice(-3).join("/")}`,
        );
      } else {
        console.log(`  L  (no dark pixels found)  ${url}`);
      }

      if (right) {
        result.right.yFrac1.push(right.yFrac1);
        result.right.xFrac1.push(right.xFrac1);
        result.right.xFrac2.push(right.xFrac2);
        // only log right if it might be a number (x2 < 0.97, not the symbol alone)
        if (right.xFrac2 < 0.97)
          console.log(
            `  R  x=[${right.xFrac1.toFixed(3)}–${right.xFrac2.toFixed(3)}]  y=[${right.yFrac1.toFixed(3)}–${right.yFrac2.toFixed(3)}]`,
          );
      }
    }

    results.push(result);
  }

  // Print summary: min/max across all samples in each era → safe bounding region
  console.log(
    "\n\n══════════ SUMMARY — safe NUMBER_REGIONS values ══════════\n",
  );
  console.log("LEFT region (standard layout):");
  for (const r of results) {
    if (r.left.yFrac1.length === 0) {
      console.log(`  ${r.era.padEnd(32)}: no data`);
      continue;
    }
    const yStart = Math.min(...r.left.yFrac1);
    const yEnd = Math.max(...r.left.yFrac2);
    const xEnd = Math.max(...r.left.xFrac2);
    // Add a 2px safety margin on a 825px card = ~0.003
    const margin = 0.005;
    console.log(
      `  ${r.era.padEnd(32)}: y=[${(yStart - margin).toFixed(3)}–${Math.min(1, yEnd + margin).toFixed(3)}]  w_needed=${(xEnd + margin).toFixed(3)}`,
    );
  }

  // Aggregate across all eras
  const allY1 = results.flatMap((r) => r.left.yFrac1);
  const allY2 = results.flatMap((r) => r.left.yFrac2);
  const allXEnd = results.flatMap((r) => r.left.xFrac2);
  if (allY1.length > 0) {
    const margin = 0.005;
    const safeY = (Math.min(...allY1) - margin).toFixed(3);
    const safeH = (
      Math.max(...allY2) -
      Math.min(...allY1) +
      margin * 2
    ).toFixed(3);
    const safeW = (Math.max(...allXEnd) + margin).toFixed(3);
    console.log(
      `\n  ✅ Recommended left region:\n     { x: 0, y: ${safeY}, w: ${safeW}, h: ${safeH} }`,
    );
  }

  console.log(`\nCrop images saved to ${OUT_DIR} — verify each one visually!`);
}

main().catch(console.error);
