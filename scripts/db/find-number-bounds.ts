/**
 * Two-part analysis:
 * 1. Column gap detection to find number right edge (classic cards)
 * 2. Brightness histogram of left 30% of modern cards to find correct DARK threshold
 */

import sharp from "sharp";

type Mode = "hist" | "gap";
const SAMPLES: { era: string; url: string; mode: Mode }[] = [
  // Modern cards — histogram mode to understand brightness distribution
  {
    era: "SV",
    url: "https://assets.tcgdex.net/en/sv/sv01/1/high.webp",
    mode: "hist",
  },
  {
    era: "SWSH",
    url: "https://assets.tcgdex.net/en/swsh/swsh1/1/high.webp",
    mode: "hist",
  },
  {
    era: "SM",
    url: "https://assets.tcgdex.net/en/sm/sm1/1/high.webp",
    mode: "hist",
  },
  {
    era: "XY",
    url: "https://assets.tcgdex.net/en/xy/xy1/1/high.webp",
    mode: "hist",
  },
  {
    era: "BW",
    url: "https://assets.tcgdex.net/en/bw/bw1/34/high.webp",
    mode: "hist",
  },
  // Classic cards — gap detection mode
  {
    era: "HGSS",
    url: "https://assets.tcgdex.net/en/hgss/hgss1/2/high.webp",
    mode: "gap",
  },
  {
    era: "PL",
    url: "https://assets.tcgdex.net/en/pl/pl1/1/high.webp",
    mode: "gap",
  },
  {
    era: "DP",
    url: "https://assets.tcgdex.net/en/dp/dp1/1/high.webp",
    mode: "gap",
  },
  {
    era: "EX",
    url: "https://assets.tcgdex.net/en/ex/ex1/71/high.webp",
    mode: "gap",
  },
  {
    era: "Base",
    url: "https://assets.tcgdex.net/en/base/base1/69/high.webp",
    mode: "gap",
  },
  {
    era: "Gym",
    url: "https://assets.tcgdex.net/en/gym/gym1/1/high.webp",
    mode: "gap",
  },
  {
    era: "Neo",
    url: "https://assets.tcgdex.net/en/neo/neo1/20/high.webp",
    mode: "gap",
  },
];

async function fetchRaw(url: string, stripFrac: number) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${resp.status} ${url}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const meta = await sharp(buf).metadata();
  const width = meta.width!;
  const height = meta.height!;
  const stripTop = Math.round(height * stripFrac);
  const stripH = height - stripTop;
  const raw = await sharp(buf)
    .extract({ left: 0, top: stripTop, width, height: stripH })
    .grayscale()
    .raw()
    .toBuffer();
  return { raw, width, height, stripTop, stripH };
}

/** Brightness histogram of left 30% to understand text brightness in modern cards */
async function analyzeHist(era: string, url: string) {
  const { raw, width, height, stripH } = await fetchRaw(url, 0.935);
  const hist = new Array(256).fill(0);
  const maxCol = Math.round(width * 0.3);
  for (let r = 0; r < stripH; r++)
    for (let c = 0; c < maxCol; c++) hist[raw[r * width + c]]++;

  const total = stripH * maxCol;
  const cum = (t: number) =>
    hist.slice(0, t).reduce((a: number, b: number) => a + b, 0);
  const pct = (n: number) => ((n / total) * 100).toFixed(1);

  // Find brightness value where cumulative pixels cross 2% — darkest text pixels
  let cumPx = 0,
    textThresh = 0;
  for (let i = 0; i < 256; i++) {
    cumPx += hist[i];
    if (cumPx / total >= 0.02 && textThresh === 0) textThresh = i;
  }

  console.log(
    `${era.padEnd(5)} [hist] <80:${pct(cum(80))}%  <100:${pct(cum(100))}%  <130:${pct(cum(130))}%` +
      `  <150:${pct(cum(150))}%  <200:${pct(cum(200))}%  darkest2%:<${textThresh}  [${width}×${height}]`,
  );
}

/** Column gap detection to find number right edge for classic cards */
async function analyzeGap(era: string, url: string) {
  const { raw, width, height, stripTop, stripH } = await fetchRaw(url, 0.93);
  const DARK = 100;
  const GAP_COLS = 10;

  const colDark = new Array(width).fill(0);
  for (let r = 0; r < stripH; r++)
    for (let c = 0; c < width; c++) if (raw[r * width + c] < DARK) colDark[c]++;

  let firstDark = -1;
  for (let c = 0; c < width; c++) {
    if (colDark[c] >= 1) {
      firstDark = c;
      break;
    }
  }
  if (firstDark < 0) {
    console.log(`${era.padEnd(5)} [gap]  no dark cols found`);
    return;
  }

  let numRight = firstDark,
    gapCount = 0;
  for (let c = firstDark; c < Math.round(width * 0.6); c++) {
    if (colDark[c] >= 1) {
      numRight = c;
      gapCount = 0;
    } else if (++gapCount >= GAP_COLS) break;
  }

  let rowMin = stripH,
    rowMax = 0;
  for (let r = 0; r < stripH; r++)
    for (let c = firstDark; c <= numRight; c++)
      if (raw[r * width + c] < DARK) {
        if (r < rowMin) rowMin = r;
        if (r > rowMax) rowMax = r;
      }

  const x1 = firstDark / width;
  const x2 = numRight / width;
  const y1 = (stripTop + rowMin) / height;
  const y2 = (stripTop + rowMax) / height;

  console.log(
    `${era.padEnd(5)} [gap]  x=[${x1.toFixed(3)}–${x2.toFixed(3)}] (${numRight - firstDark + 1}px)` +
      `  y=[${y1.toFixed(3)}–${y2.toFixed(3)}] (${rowMax - rowMin + 1}px)  [${width}×${height}]`,
  );
}

(async () => {
  for (const s of SAMPLES) {
    try {
      if (s.mode === "hist") await analyzeHist(s.era, s.url);
      else await analyzeGap(s.era, s.url);
    } catch (e) {
      console.log(`${s.era} ERROR: ${(e as Error).message}`);
    }
  }
})();
