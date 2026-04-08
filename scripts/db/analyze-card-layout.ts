/**
 * Analyses card layout by downloading sample images from each era and
 * reporting the height/proportion of the bottom strip containing
 * the card number and set symbol.
 *
 * Run with:
 *   pnpm tsx --tsconfig tsconfig.scripts.json scripts/db/analyze-card-layout.ts
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";

// One representative card per series (non-promo preferred)
const SAMPLES: { era: string; url: string }[] = [
  {
    era: "Scarlet & Violet (SV)",
    url: "https://assets.tcgdex.net/en/sv/sv01/154/high.webp",
  },
  {
    era: "Sword & Shield (SWSH)",
    url: "https://assets.tcgdex.net/en/swsh/swsh1/1/high.webp",
  },
  {
    era: "Sun & Moon (SM)",
    url: "https://assets.tcgdex.net/en/sm/sm1/1/high.webp",
  },
  { era: "XY", url: "https://assets.tcgdex.net/en/xy/xy1/1/high.webp" },
  {
    era: "Black & White (BW)",
    url: "https://assets.tcgdex.net/en/bw/bw1/34/high.webp",
  },
  {
    era: "HeartGold SoulSilver",
    url: "https://assets.tcgdex.net/en/hgss/hgss1/2/high.webp",
  },
  { era: "Platinum", url: "https://assets.tcgdex.net/en/pl/pl1/1/high.webp" },
  {
    era: "Diamond & Pearl (DP)",
    url: "https://assets.tcgdex.net/en/dp/dp1/1/high.webp",
  },
  { era: "EX", url: "https://assets.tcgdex.net/en/ex/ex1/71/high.webp" },
  {
    era: "E-Card",
    url: "https://assets.tcgdex.net/en/ecard/ecard1/130/high.webp",
  },
  { era: "Neo", url: "https://assets.tcgdex.net/en/neo/neo1/20/high.webp" },
  { era: "Gym", url: "https://assets.tcgdex.net/en/gym/gym1/1/high.webp" },
  {
    era: "Base / Jungle / Fossil",
    url: "https://assets.tcgdex.net/en/base/base1/69/high.webp",
  },
  {
    era: "Legendary Collection",
    url: "https://assets.tcgdex.net/en/lc/lc/53/high.webp",
  },
  {
    era: "Call of Legends",
    url: "https://assets.tcgdex.net/en/col/col1/12/high.webp",
  },
];

async function fetchImage(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

const OUT_DIR = "/tmp/card-analysis";

async function analyzeCard(era: string, url: string) {
  try {
    const buf = await fetchImage(url);
    const { width, height } = await sharp(buf).metadata();
    if (!width || !height) return;

    // Analyze the bottom 12% of the card
    const analyzeH = Math.round(height * 0.12);
    const analyzeTop = height - analyzeH;

    const rawBuf = await sharp(buf)
      .extract({ left: 0, top: analyzeTop, width, height: analyzeH })
      .grayscale()
      .raw()
      .toBuffer();

    // Per-row stats: avg brightness AND "text score" (stdev of center columns)
    // The copy-right strip has: white background + small dark text = high avg + high stdev
    // Card artwork with white bg: white background + slightly textured art = high avg + moderate stdev
    // Card artwork: varies in brightness, low avg stdev in pure colored areas
    // We use the combination: high avg brightness AND the CONTRAST is due to text not to art
    //
    // Key insight: look at a NARROW CENTER BAND (x=5%-95%) to avoid border
    const cx0 = Math.round(width * 0.05);
    const cx1 = Math.round(width * 0.95);
    const centerW = cx1 - cx0;

    const rowAvg: number[] = [];
    const rowStdev: number[] = [];
    const rowWhiteFrac: number[] = [];
    for (let row = 0; row < analyzeH; row++) {
      let sum = 0,
        sumSq = 0,
        white = 0;
      for (let col = cx0; col < cx1; col++) {
        const px = rawBuf[row * width + col]!;
        sum += px;
        sumSq += px * px;
        if (px >= 200) white++;
      }
      const avg = sum / centerW;
      rowAvg.push(avg);
      rowStdev.push(Math.sqrt(sumSq / centerW - avg * avg));
      rowWhiteFrac.push(white / centerW);
    }

    // The info strip is at the BOTTOM of the bottom 12% region.
    // Strategy: work from the bottom to find a cohesive run of rows with:
    //   - avg brightness >= 180 (light/white background)
    //   - stdev >= 10 (some content = text or symbol, not a pure white blank strip or border)
    // But also handle cards where the strip is very thin (some modern cards have text at <y=0.97)
    //
    // We look for the HIGHEST (largest) contiguous block of "info-like" rows
    // starting from the bottom moving upward, allowing thin dark "divider" rows.
    const INFO_AVG_MIN = 175;
    const INFO_STDEV_MIN = 8;
    let stripStartRel = analyzeH;
    let infoBlock = false;
    for (let row = analyzeH - 1; row >= 0; row--) {
      const isInfo =
        (rowAvg[row] ?? 0) >= INFO_AVG_MIN &&
        (rowStdev[row] ?? 0) >= INFO_STDEV_MIN;
      if (isInfo) {
        stripStartRel = row;
        infoBlock = true;
      } else if (infoBlock) {
        // Allow up to 3 non-info rows (border, dividers)
        let gap = 0;
        for (let r = row; r >= 0 && gap < 3; r--) {
          const ri =
            (rowAvg[r] ?? 0) >= INFO_AVG_MIN &&
            (rowStdev[r] ?? 0) >= INFO_STDEV_MIN;
          if (ri) {
            stripStartRel = r;
            break;
          }
          gap++;
        }
        break;
      }
    }

    const stripTopAbsolute = analyzeTop + stripStartRel;
    const stripTopY = stripTopAbsolute / height;
    const stripHeightPx = height - stripTopAbsolute;
    const stripHeightPct = stripHeightPx / height;

    // Per-row symbol profile for the strip: look at RIGHT side (x=50%-90%) for symbol
    // and LEFT side (x=2%-45%) for number
    const symbolCol0 = Math.round(width * 0.5);
    const symbolCol1 = Math.round(width * 0.9);
    const numberCol0 = Math.round(width * 0.02);
    const numberCol1 = Math.round(width * 0.45);

    let symbolBestRow = -1,
      symbolBestScore = 0;
    let numberBestRow = -1,
      numberBestScore = 0;
    for (let row = stripStartRel; row < analyzeH; row++) {
      // Symbol: average of stdev in right half (high stdev = symbol pixels)
      let ssum = 0;
      for (let col = symbolCol0; col < symbolCol1; col++)
        ssum += rawBuf[row * width + col]!;
      const savg = ssum / (symbolCol1 - symbolCol0);
      let sstdev = 0;
      for (let col = symbolCol0; col < symbolCol1; col++) {
        const d = rawBuf[row * width + col]! - savg;
        sstdev += d * d;
      }
      sstdev = Math.sqrt(sstdev / (symbolCol1 - symbolCol0));
      if (sstdev > symbolBestScore) {
        symbolBestScore = sstdev;
        symbolBestRow = row;
      }

      // Number: same but left half
      let nsum = 0;
      for (let col = numberCol0; col < numberCol1; col++)
        nsum += rawBuf[row * width + col]!;
      const navg = nsum / (numberCol1 - numberCol0);
      let nstdev = 0;
      for (let col = numberCol0; col < numberCol1; col++) {
        const d = rawBuf[row * width + col]! - navg;
        nstdev += d * d;
      }
      nstdev = Math.sqrt(nstdev / (numberCol1 - numberCol0));
      if (nstdev > numberBestScore) {
        numberBestScore = nstdev;
        numberBestRow = row;
      }
    }

    const symbolY =
      symbolBestRow >= 0 ? (analyzeTop + symbolBestRow) / height : -1;
    const numberY =
      numberBestRow >= 0 ? (analyzeTop + numberBestRow) / height : -1;

    // Save bottom-12% crop for visual inspection
    const slug = era.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const outPath = path.join(OUT_DIR, `${slug}.png`);
    await sharp(buf)
      .extract({ left: 0, top: analyzeTop, width, height: analyzeH })
      .png()
      .toFile(outPath);

    console.log(
      `${era.padEnd(32)} | ${width}×${height} | strip y=${stripTopY.toFixed(3)}–1.000 (${stripHeightPx}px) | num≈${numberY.toFixed(3)} sym≈${symbolY.toFixed(3)}`,
    );
  } catch (e) {
    console.log(`${era.padEnd(32)} | ERROR: ${(e as Error).message}`);
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`${"Era".padEnd(32)} | Dimensions  | Strip + peak element rows`);
  console.log("-".repeat(90));
  for (const sample of SAMPLES) {
    await analyzeCard(sample.era, sample.url);
  }
  console.log(`\nCrops saved to ${OUT_DIR}`);
}

main().catch(console.error);
