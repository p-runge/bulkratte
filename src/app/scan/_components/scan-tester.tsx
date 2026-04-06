"use client";

/**
 * ScanTester — OCR + symbol-matching card recognition tool
 *
 * Pipeline (fully automatic):
 *
 * 1. Number OCR
 *    All known card layout positions are tried in order (newest era → oldest),
 *    followed by generic fallbacks. Each region is cropped, binarized, and
 *    sent to Tesseract.js. Scanning stops at the first crop that yields a
 *    valid ID pattern (e.g. "025/165", "SWSH112", "014").
 *
 * 2. Set lookup
 *    The parsed number + total are looked up in the DB.
 *    • 1 candidate  → set uniquely identified, done.
 *    • 2+ candidates → symbol comparison picks the right one.
 *    • 0 candidates  → global symbol scan as last resort.
 *
 * 2.5 Symbol comparison (only when needed)
 *    For each candidate set the card is cropped at that set's specific known
 *    symbol position (SET_SYMBOL_POSITIONS), hashed, and compared 1:1 against
 *    its reference fingerprint. Closest cosine distance wins.
 *
 * 3. Card lookup
 *    setId + number → exact card record from the DB.
 */

import { api } from "@/lib/api/react";
import { CardImageDialog } from "@/components/card-image";
import { CameraCapture } from "@/components/camera-capture";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useJscanify } from "@/hooks/use-jscanify";
import { CARD_ASPECT_RATIO } from "@/lib/card-config";
import { Camera } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createWorker } from "tesseract.js";

type Sample = {
  id: string;
  name: string;
  number: string;
  imageLarge: string | null;
  setName: string;
  setTotal: number | null;
  setSeries: string;
};

type OcrResult = {
  parsedNumber: string | null;
  parsedTotal: number | null;
  /** Set ID resolved by symbol matching. When set, the DB query uses setId + number. */
  matchedSetId: string | null;
};

type Props = {
  // no props needed — samples are fetched client-side via tRPC
};

type ImageStep = {
  kind: "image";
  stepNumber: number;
  label: string;
  dataUrl: string;
  description: string;
  /** "card" renders taller; "strip" renders short. Default: "strip" */
  size?: "card" | "strip";
};

type TextStep = {
  kind: "text";
  stepNumber: number;
  label: string;
  text: string;
  description: string;
};

type ParsedStep = {
  kind: "parsed";
  stepNumber: number;
  label: string;
  number: string | null;
  numberError: string | null;
  total: number | null;
  description: string;
};

type RegionScanAttempt = {
  region: string;
  dataUrl: string;
  rawText: string;
  confText: string;
  matched: boolean;
  matchedPattern?: string;
};

type RegionScanStep = {
  kind: "region-scan";
  stepNumber: number;
  label: string;
  description: string;
  attempts: RegionScanAttempt[];
};

type SymbolMatch = {
  setId: string;
  symbolUrl: string;
  /** Cosine distance 0 (identical) – 1 (completely different). */
  distance: number;
};

type SymbolMatchStep = {
  kind: "symbol-match";
  stepNumber: number;
  label: string;
  description: string;
  cropDataUrl: string;
  matches: SymbolMatch[];
  winnerSetId: string | null;
};

type ScanStep =
  | ImageStep
  | TextStep
  | ParsedStep
  | RegionScanStep
  | SymbolMatchStep;

// Distributes Omit over each member of the union so discriminants are preserved
type ScanStepInput =
  | Omit<ImageStep, "stepNumber">
  | Omit<TextStep, "stepNumber">
  | Omit<ParsedStep, "stepNumber">
  | Omit<RegionScanStep, "stepNumber">
  | Omit<SymbolMatchStep, "stepNumber">;

// ── Set symbol: scan regions (ordered by probability) ─────────────────────
// ── Symbol position groups ────────────────────────────────────────────────
/**
 * Era-specific crop regions for the set symbol, derived from a pixel-level
 * scan of 181 sets (3 cards each) using right→left column-gap detection.
 * Run:  pnpm tsx --tsconfig tsconfig.scripts.json scripts/db/scan-symbol-positions.ts
 *
 * Two main layouts observed:
 *   "classic"  – tiny symbol squeezed into the far bottom-right corner
 *                (Base through Platinum/HGSS era). x1 ≈ 0.86–0.94, w ≈ 0.01–0.04
 *   "modern"   – larger symbol sitting centre-right in the strip
 *                (Sun & Moon, Sword & Shield, SV). x1 ≈ 0.40–0.55, w ≈ 0.05–0.09
 *
 * BW/XY/SV sets mostly failed detection because dark-artwork cards bleed into
 * the strip. For those eras the generic fallback regions are used.
 */
const SYMBOL_POSITION_GROUPS = [
  {
    id: "sv",
    label: "Ascended Heroes – Scarlet & Violet",
    // ⚠ CALIBRATE: copy from swsh — set manually with debugger
    region: { x: 0.38, y: 0.9, w: 0.61, h: 0.09 },
  },
  {
    id: "swsh",
    label: "Crown Zenith – Sword & Shield",
    // ⚠ CALIBRATE: set manually with debugger
    region: { x: 0.38, y: 0.9, w: 0.61, h: 0.09 },
  },
  {
    id: "sm-late",
    label: "Cosmic Eclipse – Detective Pikachu",
    // ⚠ CALIBRATE: copy from sm-early — set manually with debugger
    region: { x: 0.38, y: 0.9, w: 0.61, h: 0.09 },
  },
  {
    id: "sm-early",
    label: "Team Up – Sun & Moon",
    // SM confirmed median region
    region: { x: 0.38, y: 0.9, w: 0.61, h: 0.09 },
  },
  {
    id: "evolutions",
    label: "Evolutions",
    // ⚠ CALIBRATE: Evolutions uses XY card layout
    region: { x: 0.905, y: 0.944, w: 0.09, h: 0.042 },
  },
  {
    id: "xy-bw",
    label: "Steam Siege – Black & White",
    // ⚠ CALIBRATE: XY/BW era, bottom-right corner
    region: { x: 0.905, y: 0.944, w: 0.09, h: 0.042 },
  },
  {
    id: "kalos",
    label: "Kalos Starter Set",
    // ⚠ CALIBRATE: unique layout
    region: { x: 0.905, y: 0.944, w: 0.09, h: 0.042 },
  },
  {
    id: "hgss",
    label: "Call of Legends – HeartGold SoulSilver",
    // ⚠ CALIBRATE: HGSS era, bottom-right corner
    region: { x: 0.905, y: 0.944, w: 0.09, h: 0.042 },
  },
  {
    id: "platinum",
    label: "Arceus – Platinum",
    // ⚠ CALIBRATE: Platinum era, bottom-right corner
    region: { x: 0.905, y: 0.944, w: 0.09, h: 0.042 },
  },
  {
    id: "ex-dp",
    label: "Pop Series 9 – Team Magma vs Team Aqua",
    // EX: 16 sets median x=[0.932–0.956] y=[0.953–0.971]; DP: 8 sets median x=[0.932–0.961] y=[0.953–0.973]
    region: { x: 0.905, y: 0.944, w: 0.09, h: 0.042 },
  },
  {
    id: "ex-early",
    label: "Dragon – Ruby & Sapphire (no yellow edge)",
    // ⚠ CALIBRATE with debugger
    region: { x: 0.754, y: 0.915, w: 0.081, h: 0.028 },
  },
  {
    id: "ex-border",
    label: "Dragon – Ruby & Sapphire (yellow edge)",
    // ⚠ CALIBRATE with debugger
    region: { x: 0.754, y: 0.915, w: 0.081, h: 0.028 },
  },
  {
    id: "ecard",
    label: "Skyridge – Expedition Base Set",
    // E-Card outlier: x=0.868–0.928 — ⚠ CALIBRATE with debugger
    region: { x: 0.754, y: 0.915, w: 0.081, h: 0.028 },
  },
  {
    id: "wotc",
    label: "Legendary Collection – Base Set",
    // Base/Gym/Neo/LC median x=[0.935–0.953] y=[0.956–0.966]
    region: { x: 0.85, y: 0.944, w: 0.072, h: 0.037 },
  },
] as const;

/** Fallback symbol regions tried when no era group is known, in order. */
const SYMBOL_REGIONS = [
  {
    // Modern sets: symbol is centre-right in the strip
    label: "Centre-right strip (modern)",
    x: 0.38,
    y: 0.9,
    w: 0.61,
    h: 0.09,
  },
  {
    // Classic sets: symbol is a tiny icon in the far bottom-right corner
    label: "Far right corner (classic)",
    x: 0.83,
    y: 0.9,
    w: 0.16,
    h: 0.09,
  },
  {
    // Full-width fallback: entire info strip
    label: "Full bottom strip (fallback)",
    x: 0.05,
    y: 0.895,
    w: 0.9,
    h: 0.1,
  },
] as const;

/**
 * Confidence threshold: a cosine distance ≤ this value is considered a match.
 * Range 0 (identical) – 1 (completely different). 0.12 means ≥88% cosine similarity.
 */
const SYMBOL_DISTANCE_THRESHOLD = 0.12;

/**
 * Per-set symbol bounding boxes (x1, x2, y1, y2 as fractions of card dimensions).
 * Derived from scan-symbol-positions.ts run against 181 sets (3 cards each).
 * 109/181 sets have clean detections; the rest fall back to era-group regions.
 *
 * Re-run:  pnpm tsx --tsconfig tsconfig.scripts.json scripts/db/scan-symbol-positions.ts
 */
const SET_SYMBOL_POSITIONS: Record<
  string,
  { x1: number; x2: number; y1: number; y2: number }
> = {
  base1: { x1: 0.9417, x2: 0.9533, y1: 0.9552, y2: 0.9648 },
  base2: { x1: 0.94, x2: 0.9517, y1: 0.9588, y2: 0.9673 },
  basep: { x1: 0.9317, x2: 0.9517, y1: 0.9564, y2: 0.9661 },
  base3: { x1: 0.94, x2: 0.9533, y1: 0.9624, y2: 0.9709 },
  base4: { x1: 0.9417, x2: 0.9533, y1: 0.9564, y2: 0.9661 },
  base5: { x1: 0.9417, x2: 0.9533, y1: 0.9576, y2: 0.9661 },
  gym1: { x1: 0.9383, x2: 0.9517, y1: 0.9576, y2: 0.9673 },
  gym2: { x1: 0.9367, x2: 0.9517, y1: 0.9588, y2: 0.9685 },
  neo1: { x1: 0.935, x2: 0.9483, y1: 0.9564, y2: 0.9661 },
  neo2: { x1: 0.9333, x2: 0.9483, y1: 0.9552, y2: 0.9648 },
  si1: { x1: 0.6883, x2: 0.9233, y1: 0.9018, y2: 0.9661 },
  neo3: { x1: 0.9367, x2: 0.95, y1: 0.9564, y2: 0.9648 },
  neo4: { x1: 0.9383, x2: 0.9483, y1: 0.9588, y2: 0.9685 },
  lc: { x1: 0.9367, x2: 0.95, y1: 0.9564, y2: 0.9661 },
  ecard1: { x1: 0.8325, x2: 0.9567, y1: 0.9006, y2: 0.9436 },
  ecard2: { x1: 0.9, x2: 0.9283, y1: 0.9006, y2: 0.9297 },
  ecard3: { x1: 0.8683, x2: 0.8992, y1: 0.9091, y2: 0.9521 },
  ex1: { x1: 0.925, x2: 0.9433, y1: 0.9491, y2: 0.9655 },
  ex2: { x1: 0.875, x2: 0.9325, y1: 0.9, y2: 0.9382 },
  ex3: { x1: 0.9025, x2: 0.9387, y1: 0.9027, y2: 0.9609 },
  ex4: { x1: 0.935, x2: 0.9525, y1: 0.9582, y2: 0.9709 },
  ex5: { x1: 0.9283, x2: 0.9617, y1: 0.9545, y2: 0.9737 },
  ex6: { x1: 0.925, x2: 0.955, y1: 0.9545, y2: 0.9745 },
  ex7: { x1: 0.9383, x2: 0.9533, y1: 0.9521, y2: 0.9713 },
  ex8: { x1: 0.935, x2: 0.96, y1: 0.9527, y2: 0.9685 },
  ex9: { x1: 0.9267, x2: 0.9583, y1: 0.9564, y2: 0.9733 },
  ex10: { x1: 0.9333, x2: 0.9583, y1: 0.9539, y2: 0.9709 },
  ex11: { x1: 0.9333, x2: 0.9567, y1: 0.9564, y2: 0.9733 },
  ex12: { x1: 0.93, x2: 0.9533, y1: 0.9503, y2: 0.9697 },
  ex13: { x1: 0.935, x2: 0.96, y1: 0.9564, y2: 0.9721 },
  ex14: { x1: 0.9483, x2: 0.955, y1: 0.9564, y2: 0.9673 },
  ex15: { x1: 0.9317, x2: 0.9567, y1: 0.9527, y2: 0.9636 },
  ex16: { x1: 0.9317, x2: 0.9617, y1: 0.9515, y2: 0.9733 },
  np: { x1: 0.925, x2: 0.9533, y1: 0.9539, y2: 0.9733 },
  pop1: { x1: 0.9183, x2: 0.9617, y1: 0.9545, y2: 0.9725 },
  pop2: { x1: 0.925, x2: 0.9633, y1: 0.9564, y2: 0.9709 },
  pop3: { x1: 0.925, x2: 0.96, y1: 0.9539, y2: 0.9673 },
  pop4: { x1: 0.9233, x2: 0.9683, y1: 0.9539, y2: 0.9745 },
  pop5: { x1: 0.9233, x2: 0.9617, y1: 0.9552, y2: 0.9709 },
  pop6: { x1: 0.925, x2: 0.9658, y1: 0.96, y2: 0.9733 },
  pop7: { x1: 0.925, x2: 0.965, y1: 0.96, y2: 0.9782 },
  pop8: { x1: 0.915, x2: 0.965, y1: 0.9588, y2: 0.977 },
  pop9: { x1: 0.9183, x2: 0.9667, y1: 0.9588, y2: 0.9782 },
  dpp: { x1: 0.93, x2: 0.96, y1: 0.9527, y2: 0.9733 },
  dp1: { x1: 0.9367, x2: 0.96, y1: 0.9539, y2: 0.9721 },
  dp2: { x1: 0.9317, x2: 0.96, y1: 0.9527, y2: 0.9733 },
  dp3: { x1: 0.9383, x2: 0.9583, y1: 0.9539, y2: 0.9733 },
  dp4: { x1: 0.93, x2: 0.9633, y1: 0.9527, y2: 0.9733 },
  dp5: { x1: 0.9333, x2: 0.965, y1: 0.9527, y2: 0.9758 },
  dp6: { x1: 0.93, x2: 0.9633, y1: 0.9527, y2: 0.9733 },
  dp7: { x1: 0.9333, x2: 0.9617, y1: 0.9515, y2: 0.9721 },
  pl1: { x1: 0.93, x2: 0.955, y1: 0.9612, y2: 0.9709 },
  pl2: { x1: 0.9367, x2: 0.9567, y1: 0.9576, y2: 0.9745 },
  pl3: { x1: 0.9367, x2: 0.95, y1: 0.9552, y2: 0.9636 },
  pl4: { x1: 0.9333, x2: 0.9583, y1: 0.9576, y2: 0.9721 },
  ru1: { x1: 0.9283, x2: 0.9567, y1: 0.9576, y2: 0.977 },
  hgss1: { x1: 0.865, x2: 0.9443, y1: 0.9379, y2: 0.9818 },
  hgssp: { x1: 0.8242, x2: 0.9683, y1: 0.9333, y2: 0.9891 },
  hgss2: { x1: 0.9343, x2: 0.9786, y1: 0.9081, y2: 0.9869 },
  hgss3: { x1: 0.4429, x2: 0.9757, y1: 0.904, y2: 0.9869 },
  hgss4: { x1: 0.9286, x2: 0.9786, y1: 0.9545, y2: 0.9869 },
  col1: { x1: 0.9386, x2: 0.9786, y1: 0.9535, y2: 0.9869 },
  bwp: { x1: 0.92, x2: 0.9586, y1: 0.9491, y2: 0.9768 },
  bw8: { x1: 0.9583, x2: 0.9983, y1: 0.9006, y2: 0.9988 },
  bw9: { x1: 0.9733, x2: 0.9983, y1: 0.9818, y2: 0.9988 },
  xy4: { x1: 0.8833, x2: 0.9983, y1: 0.9006, y2: 0.9988 },
  xy7: { x1: 0.7386, x2: 0.9986, y1: 0.9, y2: 0.999 },
  xy9: { x1: 0.9617, x2: 0.9983, y1: 0.9006, y2: 0.9988 },
  xy11: { x1: 0.9733, x2: 0.9983, y1: 0.9091, y2: 0.9988 },
  smp: { x1: 0.6959, x2: 0.9986, y1: 0.9461, y2: 0.999 },
  sm1: { x1: 0.4529, x2: 0.9457, y1: 0.9051, y2: 0.9747 },
  sm2: { x1: 0.4514, x2: 0.93, y1: 0.903, y2: 0.9758 },
  sm3: { x1: 0.4529, x2: 0.9329, y1: 0.903, y2: 0.9758 },
  sm4: { x1: 0.4003, x2: 0.9463, y1: 0.9, y2: 0.96 },
  sm5: { x1: 0.4529, x2: 0.9314, y1: 0.9172, y2: 0.9636 },
  sm6: { x1: 0.4, x2: 0.9986, y1: 0.9, y2: 0.999 },
  sm7: { x1: 0.8343, x2: 0.9557, y1: 0.9, y2: 0.9121 },
  sm8: { x1: 0.4003, x2: 0.9632, y1: 0.9, y2: 0.971 },
  sm9: { x1: 0.8543, x2: 0.942, y1: 0.915, y2: 0.947 },
  det1: { x1: 0.4537, x2: 0.9373, y1: 0.9023, y2: 0.9653 },
  sm10: { x1: 0.9918, x2: 0.9986, y1: 0.9922, y2: 0.999 },
  sm11: { x1: 0.9918, x2: 0.9986, y1: 0.9756, y2: 0.999 },
  sma: { x1: 0.9918, x2: 0.9986, y1: 0.9922, y2: 0.999 },
  sm115: { x1: 0.9918, x2: 0.9986, y1: 0.9922, y2: 0.999 },
  swshp: { x1: 0.6583, x2: 0.9983, y1: 0.9121, y2: 0.9988 },
  swsh1: { x1: 0.9217, x2: 0.9983, y1: 0.92, y2: 0.9988 },
  swsh2: { x1: 0.9117, x2: 0.9983, y1: 0.9115, y2: 0.9988 },
  fut2020: { x1: 0.4251, x2: 0.9346, y1: 0.9043, y2: 0.9854 },
  "swsh3.5": { x1: 0.66, x2: 0.9983, y1: 0.9061, y2: 0.9988 },
  swsh4: { x1: 0.92, x2: 0.9983, y1: 0.9115, y2: 0.9988 },
  "swsh4.5": { x1: 0.4, x2: 0.9983, y1: 0.9006, y2: 0.9988 },
  swsh5: { x1: 0.4, x2: 0.9983, y1: 0.9006, y2: 0.9988 },
  swsh6: { x1: 0.4, x2: 0.9983, y1: 0.9006, y2: 0.9988 },
  swsh7: { x1: 0.4, x2: 0.9983, y1: 0.9006, y2: 0.9988 },
  cel25: { x1: 0.405, x2: 0.935, y1: 0.9152, y2: 0.9855 },
  swsh9: { x1: 0.4, x2: 0.9983, y1: 0.9006, y2: 0.9988 },
  swsh10: { x1: 0.4, x2: 0.9983, y1: 0.9006, y2: 0.9988 },
  "swsh10.5": { x1: 0.9133, x2: 0.9983, y1: 0.9115, y2: 0.9988 },
  swsh11: { x1: 0.4, x2: 0.9983, y1: 0.9006, y2: 0.9988 },
  swsh12: { x1: 0.4, x2: 0.9983, y1: 0.9006, y2: 0.9988 },
  "swsh12.5": { x1: 0.4, x2: 0.9983, y1: 0.9006, y2: 0.9988 },
  sv01: { x1: 0.9558, x2: 0.9983, y1: 0.9073, y2: 0.9988 },
  svp: { x1: 0.9617, x2: 0.9983, y1: 0.9103, y2: 0.9988 },
  "sv03.5": { x1: 0.9533, x2: 0.9983, y1: 0.9115, y2: 0.9988 },
  sv07: { x1: 0.9533, x2: 0.9983, y1: 0.9055, y2: 0.9988 },
  sv08: { x1: 0.9733, x2: 0.9983, y1: 0.9103, y2: 0.9988 },
  "sv08.5": { x1: 0.905, x2: 0.9983, y1: 0.9091, y2: 0.9988 },
  sv09: { x1: 0.9533, x2: 0.9983, y1: 0.9091, y2: 0.9988 },
  "sv10.5b": { x1: 0.4, x2: 0.9983, y1: 0.9006, y2: 0.9988 },
};

// ── Number position groups ────────────────────────────────────────────────
/**
 * Every card era uses a distinct info-strip layout.  Once a set is identified
 * the scanner can skip the generic wide regions and go straight to the exact
 * crop for that era, improving OCR accuracy and speed.
 *
 * Values derived from a pixel-level scan of 181 sets (2 cards each) using
 * column-gap detection across multiple brightness thresholds.
 * Run:  pnpm tsx --tsconfig tsconfig.scripts.json scripts/db/scan-set-positions.ts
 */
const NUMBER_POSITION_GROUPS = [
  {
    id: "sv",
    label: "Ascended Heroes – Scarlet & Violet",
    // ⚠ CALIBRATE: copy from swsh — set manually with debugger
    region: { x: 0.167, y: 0.949, w: 0.105, h: 0.017 },
  },
  {
    id: "swsh",
    label: "Crown Zenith – Sword & Shield",
    // Empirical: SWSH era confirmed region
    region: { x: 0.157, y: 0.949, w: 0.099, h: 0.017 },
  },
  {
    id: "sm-late",
    label: "Cosmic Eclipse – Detective Pikachu",
    // ⚠ CALIBRATE: copy from sm-early — set manually with debugger
    region: { x: 0.115, y: 0.934, w: 0.091, h: 0.019 },
  },
  {
    id: "sm-early",
    label: "Team Up – Sun & Moon",
    // Empirical: 6 confirmed SM sets
    region: { x: 0.1, y: 0.951, w: 0.092, h: 0.017 },
  },
  {
    id: "evolutions",
    label: "Evolutions",
    // ⚠ CALIBRATE: XY card layout, Base Set art — set manually with debugger
    region: { x: 0.81, y: 0.95, w: 0.075, h: 0.017 },
  },
  {
    id: "xy-bw",
    label: "Steam Siege – Black & White",
    // ⚠ CALIBRATE: XY/BW era — set manually with debugger
    region: { x: 0.771, y: 0.946, w: 0.088, h: 0.017 },
  },
  {
    id: "kalos",
    label: "Kalos Starter Set",
    // ⚠ CALIBRATE: unique layout — set manually with debugger
    region: { x: 0.815, y: 0.946, w: 0.067, h: 0.017 },
  },
  {
    id: "hgss",
    label: "Call of Legends – HeartGold SoulSilver",
    // ⚠ CALIBRATE: HGSS era — set manually with debugger
    region: { x: 0.815, y: 0.965, w: 0.078, h: 0.015 },
  },
  {
    id: "platinum",
    label: "Arceus – Platinum",
    // ⚠ CALIBRATE: Platinum era — set manually with debugger
    region: { x: 0.807, y: 0.961, w: 0.091, h: 0.017 },
  },
  {
    id: "ex-dp",
    label: "Pop Series 9 – Team Magma vs Team Aqua",
    // EX empirical (16 sets): x1=0.121, y1=0.919, y2=0.963
    // DP empirical (8 sets): x1=0.087, y1=0.911, y2=0.973
    region: { x: 0.797, y: 0.962, w: 0.096, h: 0.017 },
  },
  {
    id: "ex-early",
    label: "Dragon – Ruby & Sapphire (no yellow edge)",
    // ⚠ CALIBRATE with debugger
    region: { x: 0.728, y: 0.952, w: 0.093, h: 0.017 },
  },
  {
    id: "ex-border",
    label: "Dragon – Ruby & Sapphire (yellow edge)",
    // ⚠ CALIBRATE with debugger
    region: { x: 0.811, y: 0.922, w: 0.087, h: 0.017 },
  },
  {
    id: "ecard",
    label: "Skyridge – Expedition Base Set",
    // E-Card empirical: x1=0.065, y1=0.944 — ⚠ CALIBRATE with debugger
    region: { x: 0.744, y: 0.92, w: 0.088, h: 0.017 },
  },
  {
    id: "wotc",
    label: "Legendary Collection – Base Set",
    // Empirical: Base x1=0.043 y1=0.935; Gym x1=0.043 y1=0.927; Neo x1=0.046 y1=0.935; LC x1=0.050 y1=0.932
    region: { x: 0.849, y: 0.951, w: 0.083, h: 0.017 },
  },
] as const;

type ScanGroupId = (typeof NUMBER_POSITION_GROUPS)[number]["id"];

/**
 * Maps every TCGdex series name to the scan-group that best covers its
 * info-strip layout.  Series not listed here fall back to generic regions.
 */
const SERIES_TO_SCAN_GROUP: Record<string, ScanGroupId | undefined> = {
  // — Scarlet & Violet + Mega Evolution era —
  "Scarlet & Violet": "sv",
  "Mega Evolution": "sv", // Japanese 2025–26 sets (me02, me02.5)
  // — Sword & Shield era —
  "Sword & Shield": "swsh",
  // — Sun & Moon era (sm-early covers the majority) —
  "Sun & Moon": "sm-early",
  // — XY + Black & White era —
  XY: "xy-bw",
  "Black & White": "xy-bw",
  // — HeartGold & SoulSilver era —
  "HeartGold & SoulSilver": "hgss",
  "Call of Legends": "hgss",
  // — Platinum era —
  Platinum: "platinum",
  // — EX + DP + POP era —
  EX: "ex-dp", // ex4–ex16 are the majority; ex1–3 are ex-early
  "Diamond & Pearl": "ex-dp",
  POP: "ex-dp",
  // — E-Card era —
  "E-Card": "ecard",
  // — Classic WotC era —
  Base: "wotc",
  Gym: "wotc",
  Neo: "wotc",
  "Legendary Collection": "wotc",
  // — Excluded / unclassifiable —
  "McDonald's Collection": undefined,
  "Trainer kits": undefined,
  Miscellaneous: undefined,
} as Record<string, ScanGroupId | undefined>;

// ── Card number: scan regions (ordered by probability) ─────────────────────
/**
 * Regions to scan for the card number, tried in order.
 * Scanning stops at the first region where a valid pattern is found.
 */
const NUMBER_REGIONS = [
  {
    // Number is bottom-left. Pixel analysis shows digits start at x≈0.02 and
    // span up to x≈0.29 (EX/DP era, widest format). Strip starts at y≈0.930
    // for classic sets; widening from the old y=0.942 captures the full digit
    // height (EX text spans y=[0.931–0.984], i.e. ~5% of card height).
    label: "Bottom-left strip",
    description: "Number is bottom-left on the vast majority of sets.",
    x: 0,
    y: 0.93,
    w: 0.3,
    h: 0.07,
  },
  {
    // Full Art / Trainer Gallery / Rainbow Rare prints place the number
    // bottom-right. x=0.65 skips centre content and focuses on that corner.
    label: "Bottom-right strip",
    description: "Full Art / Trainer Gallery / Rainbow Rare prints.",
    x: 0.65,
    y: 0.93,
    w: 0.32,
    h: 0.07,
  },
  {
    // Full-width sweep as last resort. Excludes the top of the card body
    // (y<0.925) where HP/damage numbers live.
    label: "Full bottom strip (fallback)",
    description: "Full-width sweep of the info strip.",
    x: 0,
    y: 0.925,
    w: 0.9,
    h: 0.075,
  },
] as const;

/**
 * Card number format patterns, from most to least specific.
 * Each pattern includes a human-readable label shown in the UI on a match.
 */
const NUMBER_PATTERNS: {
  label: string;
  re: RegExp;
  extract: (m: RegExpMatchArray) => { number: string; total: number | null };
}[] = [
  {
    label: "Trainer Gallery (TG01/TG30)",
    re: /TG\s*(\d{2})\s*[/\\|]\s*TG\s*(\d{2})/i,
    extract: (m) => ({ number: `TG${m[1]}`, total: parseInt(m[2]!, 10) }),
  },
  {
    label: "Alternate Art (GG01/GG70)",
    re: /GG\s*(\d{2})\s*[/\\|]\s*GG\s*(\d{2})/i,
    extract: (m) => ({ number: `GG${m[1]}`, total: parseInt(m[2]!, 10) }),
  },
  {
    label: "Modern Promo (SWSH001, SV001, BW-P …)",
    re: /\b(SWSH|BW|XY|SM|SV|SVP)\s*-?\s*(\d{1,4})\b/i,
    extract: (m) => ({ number: `${m[1]!.toUpperCase()}${m[2]}`, total: null }),
  },
  {
    label: "Standard (025/165)",
    re: /(\d{1,4})\s*[/\\|]\s*(\d{1,4})/,
    extract: (m) => ({ number: m[1]!, total: parseInt(m[2]!, 10) }),
  },
  {
    label: "Standalone promo number (e.g. 014)",
    re: /^\s*(\d{1,3})\s*$/,
    extract: (m) => ({ number: m[1]!, total: null }),
  },
];

export function ScanTester() {
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [activeSample, setActiveSample] = useState<Sample | null>(null);
  const [sampleFilter, setSampleFilter] = useState<ScanGroupId | "all">("all");

  const samplesQuery = api.card.getScanSamples.useQuery(sampleFilter);
  const filteredSamples = samplesQuery.data ?? [];
  const [isScanning, setIsScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [scanSteps, setScanSteps] = useState<ScanStep[]>([]);
  const [zoomImage, setZoomImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [hasCameraSupport, setHasCameraSupport] = useState(false);

  useEffect(() => {
    // getUserMedia requires a secure context (HTTPS / localhost).
    // Checking for the function directly is more reliable than checking
    // for the mediaDevices object, which browsers set to undefined on HTTP.
    setHasCameraSupport(
      typeof navigator !== "undefined" &&
        typeof navigator.mediaDevices?.getUserMedia === "function",
    );
  }, []);

  // ── Crop debugger state ─────────────────────────────────────────
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugGroupId, setDebugGroupId] = useState<ScanGroupId>(
    NUMBER_POSITION_GROUPS[0].id,
  );
  const [debugRegion, setDebugRegion] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  }>(() => ({ ...NUMBER_POSITION_GROUPS[0].region }));
  const [debugCropUrl, setDebugCropUrl] = useState<string | null>(null);
  const [debugOcrText, setDebugOcrText] = useState<string | null>(null);
  const [debugOcrRunning, setDebugOcrRunning] = useState(false);

  // Rebuild the crop preview whenever the region or active image changes.
  useEffect(() => {
    if (!debugOpen || !activeImage) return;
    let cancelled = false;
    void (async () => {
      const img = await loadImage(activeImage);
      if (cancelled) return;
      const crop = cropImage(
        img,
        debugRegion.x,
        debugRegion.y,
        debugRegion.w,
        debugRegion.h,
      );
      const processed = applyProcessing(crop, 4);
      setDebugCropUrl(processed.toDataURL());
      setDebugOcrText(null);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debugOpen,
    activeImage,
    debugRegion.x,
    debugRegion.y,
    debugRegion.w,
    debugRegion.h,
  ]);

  async function runDebugOcr() {
    if (!activeImage) return;
    setDebugOcrRunning(true);
    setDebugOcrText(null);
    const img = await loadImage(activeImage);
    const crop = cropImage(
      img,
      debugRegion.x,
      debugRegion.y,
      debugRegion.w,
      debugRegion.h,
    );
    const processed = applyProcessing(crop, 4);
    const w = await createWorker("eng");
    await w.setParameters({ tessedit_pageseg_mode: "6" as never });
    const result = await w.recognize(processed);
    await w.terminate();
    setDebugOcrText(result.data.text?.trim() || "(nothing detected)");
    setDebugOcrRunning(false);
  }

  // ── jscanify (perspective correction) ────────────────────────────────────
  const { scanner: jscanifyScanner, ready: jscanifyReady } = useJscanify();

  // ── Symbol index pre-fetch ───────────────────────────────────────────
  // Each set symbol image is downloaded, drawn to a 32×32 canvas, and stored
  // as a 1024-element normalised grayscale vector.  At scan time, cosine
  // distance against all ~150 vectors takes <1 ms.
  const symbolHashMap = useRef<
    Map<string, { hash: number[]; symbolUrl: string }>
  >(new Map());
  const [symbolsLoaded, setSymbolsLoaded] = useState(0);
  const [symbolsTotal, setSymbolsTotal] = useState(0);

  const symbolIndex = api.set.getSymbolIndex.useQuery();

  /** setId → series name, built once the symbol index arrives. */
  const setSeriesMap = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!symbolIndex.data) return;
    const map = new Map<string, string>();
    symbolIndex.data.forEach((s) => {
      if (s.series) map.set(s.id, s.series);
    });
    setSeriesMap.current = map;
  }, [symbolIndex.data]);

  useEffect(() => {
    if (!symbolIndex.data) return;
    const items = symbolIndex.data.filter(
      (s): s is typeof s & { symbol: string } => !!s.symbol,
    );
    setSymbolsTotal(items.length);

    const map = new Map<string, { hash: number[]; symbolUrl: string }>();
    let done = 0;

    // Process in parallel batches of 20 to stay fast without hammering the CDN
    async function processAll() {
      const BATCH = 20;
      for (let i = 0; i < items.length; i += BATCH) {
        await Promise.all(
          items.slice(i, i + BATCH).map(async (s) => {
            try {
              // crossOrigin="anonymous" required for canvas drawing.
              // assets.tcgdex.net is a public CDN that sends CORS headers.
              const img = await loadImage(s.symbol, true);
              const canvas = document.createElement("canvas");
              canvas.width = img.naturalWidth || 64;
              canvas.height = img.naturalHeight || 64;
              const ctx = canvas.getContext("2d")!;
              // Fill white first so transparent pixels become white, not black.
              // Without this, transparent backgrounds read as r=g=b=0 and the
              // entire fingerprint collapses to near-zero, making every symbol
              // look identical to the cosine distance function.
              ctx.fillStyle = "#fff";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0);
              // Binarize and isolate (same pipeline as the card crop).
              const refBin = binarize(canvas, 1, false);
              const refNorm = isolateSymbol(refBin, 0);
              map.set(s.id, {
                hash: imgFingerprint(refNorm),
                symbolUrl: s.symbol,
              });
            } catch {
              // CORS or load failure — skip this symbol silently
            }
            done++;
            setSymbolsLoaded(done);
          }),
        );
      }
      symbolHashMap.current = map;
    }

    void processAll();
  }, [symbolIndex.data]);

  const utils = api.useUtils();

  const lookupQuery = api.card.findByOcr.useQuery(
    {
      setId: ocrResult?.matchedSetId ?? undefined,
      number: ocrResult?.parsedNumber ?? undefined,
      setTotal: ocrResult?.parsedTotal ?? undefined,
    },
    { enabled: ocrResult !== null },
  );

  async function runOcr(imageUrl: string, priorityGroupId?: ScanGroupId) {
    setIsScanning(true);
    setOcrResult(null);
    setScanSteps([]);

    const steps: ScanStep[] = [];
    let n = 0;

    function pushStep(step: ScanStepInput) {
      n++;
      const s = { ...step, stepNumber: n } as ScanStep;
      steps.push(s);
      setScanSteps([...steps]);
    }

    try {
      const img = await loadImage(imageUrl);

      // ── jscanify: perspective correction ──────────────────────────────────
      // Try to detect the card outline and warp it to a flat rectangle.
      // extractPaper() returns null when no clear boundary is found, in which
      // case we fall back to the original image (sample cards, clean scans, etc.)

      let cardSource: HTMLImageElement | HTMLCanvasElement = img;
      const currentScanner = jscanifyScanner.current;

      if (currentScanner) {
        try {
          const targetH = img.naturalHeight;
          const targetW = Math.round(targetH * CARD_ASPECT_RATIO);
          const corrected = currentScanner.extractPaper(img, targetW, targetH);

          if (corrected) {
            cardSource = corrected;
            pushStep({
              kind: "image",
              label: "jscanify: perspective corrected",
              dataUrl: corrected.toDataURL(),
              description: `Card boundary detected and warped to ${targetW}×${targetH}px. All subsequent crops use this corrected image.`,
              size: "card",
            });
          } else {
            pushStep({
              kind: "image",
              label: "jscanify: no card boundary found",
              dataUrl: cropFull(img).toDataURL(),
              description:
                "No clear card outline detected (clean scan or flat image). Using original image.",
              size: "card",
            });
          }
        } catch (e) {
          pushStep({
            kind: "image",
            label: "jscanify: error (using original)",
            dataUrl: cropFull(img).toDataURL(),
            description: `Perspective correction failed: ${e instanceof Error ? e.message : String(e)}.`,
            size: "card",
          });
        }
      } else {
        pushStep({
          kind: "image",
          label: "jscanify: OpenCV loading…",
          dataUrl: cropFull(img).toDataURL(),
          description:
            "OpenCV is still loading. Using original image for this scan.",
          size: "card",
        });
      }

      // ── Step 1: Number OCR ────────────────────────────────────────────────
      // Most reliable signal. Number + total uniquely identify the set in
      // most cases. Symbol matching is only used when multiple sets share
      // the same number/total combination.
      //
      // When a series is already known from a previous scan, the targeted
      // group's crop region is tried first.  This is narrower and more
      // accurate than the generic wide sweep.

      type TWord = { text: string; confidence: number };
      type TLine = { words: TWord[] };
      type TData = { lines: TLine[] };

      const worker = await createWorker("eng");
      await worker.setParameters({ tessedit_pageseg_mode: "6" as never });

      let parsedNumber: string | null = null;
      let parsedTotal: number | null = null;
      let numberError: string | null = null;
      const regionAttempts: RegionScanAttempt[] = [];

      // All era-specific positions tried: priority group first (when known),
      // then remaining groups newest → oldest, then generic fallbacks.
      const priorityGroup = priorityGroupId
        ? NUMBER_POSITION_GROUPS.find((g) => g.id === priorityGroupId)
        : undefined;
      const regionsToScan: ReadonlyArray<{
        label: string;
        description: string;
        x: number;
        y: number;
        w: number;
        h: number;
      }> = [
        ...(priorityGroup
          ? [
              {
                label: priorityGroup.label,
                description: `Card layout: ${priorityGroup.label} (priority)`,
                ...priorityGroup.region,
              },
            ]
          : []),
        ...NUMBER_POSITION_GROUPS.filter((g) => g.id !== priorityGroupId).map(
          (g) => ({
            label: g.label,
            description: `Card layout: ${g.label}`,
            ...g.region,
          }),
        ),
        ...NUMBER_REGIONS,
      ];

      for (const region of regionsToScan) {
        if (parsedNumber !== null) break;

        const regionCrop = cropImage(
          cardSource,
          region.x,
          region.y,
          region.w,
          region.h,
        );
        const regionProcessed = applyProcessing(regionCrop, 4);
        const regionResult = await worker.recognize(regionProcessed);

        const regionWords: TWord[] =
          (regionResult.data as unknown as TData).lines?.flatMap(
            (l) => l.words,
          ) ?? [];
        const confText = regionWords
          .filter((w) => w.confidence >= 70)
          .map((w) => w.text)
          .join(" ");
        const rawText = regionResult.data.text?.trim() ?? "";

        let matched = false;
        for (const pattern of NUMBER_PATTERNS) {
          const m = confText.match(pattern.re) ?? rawText.match(pattern.re);
          if (m) {
            const extracted = pattern.extract(m);
            parsedNumber = extracted.number;
            parsedTotal = extracted.total;
            matched = true;
            regionAttempts.push({
              region: region.label,
              dataUrl: regionProcessed.toDataURL(),
              rawText,
              confText,
              matched: true,
              matchedPattern: pattern.label,
            });
            break;
          }
        }

        if (!matched) {
          regionAttempts.push({
            region: region.label,
            dataUrl: regionProcessed.toDataURL(),
            rawText,
            confText,
            matched: false,
          });
        }
      }

      if (parsedNumber === null) {
        const allRaw = regionAttempts
          .map((a) => a.rawText)
          .filter(Boolean)
          .join(" | ");
        numberError = allRaw
          ? `No known format matched. Raw OCR: "${allRaw.slice(0, 120)}"`
          : "No text detected in any region.";
      }

      pushStep({
        kind: "region-scan",
        label: "Number: scan all layout regions",
        description:
          "All era-specific layouts tried in order (newest → oldest), then generic fallbacks. Stops at first match. Confidence-filtered text (≥70%) is tried first; raw OCR is the fallback.",
        attempts: regionAttempts,
      });

      // ── Number fallback: digit whitelist ─────────────────────────────────
      if (parsedNumber === null) {
        const digitCrop = cropImage(cardSource, 0, 0.938, 0.9, 0.062);
        const digitBinary = binarize(digitCrop, 4, false);
        await worker.setParameters({
          tessedit_pageseg_mode: "6" as never,
          tessedit_char_whitelist:
            "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz/ " as never,
        });
        const digitResult = await worker.recognize(digitBinary);
        const digitText = digitResult.data.text?.trim() ?? "";

        let digitMatched = false;
        for (const pattern of NUMBER_PATTERNS) {
          const m = digitText.match(pattern.re);
          if (m) {
            const extracted = pattern.extract(m);
            if (extracted.total !== null && extracted.total < 5) continue;
            parsedNumber = extracted.number;
            parsedTotal = extracted.total;
            numberError = null;
            digitMatched = true;
            break;
          }
        }
        if (!digitMatched) {
          const m2 = digitText.match(/(\d{1,4})\s+(\d{2,4})/);
          if (m2) {
            const candidateTotal = parseInt(m2[2]!, 10);
            if (candidateTotal >= 5) {
              parsedNumber = m2[1]!;
              parsedTotal = candidateTotal;
              numberError = null;
              digitMatched = true;
            }
          }
        }

        pushStep({
          kind: "text",
          label: "Number fallback: digit whitelist OCR",
          text: digitText || "(no digits detected)",
          description: digitMatched
            ? `Digit whitelist fallback succeeded: matched "${parsedNumber}/${parsedTotal}".`
            : "Digit whitelist fallback found no number pattern either.",
        });

        if (!digitMatched) {
          numberError = digitText
            ? `No number pattern in digit-only pass: "${digitText.slice(0, 80)}"`
            : "No digits detected in bottom strip.";
        }
      }

      await worker.terminate();

      // ── Step 2: DB candidate lookup ───────────────────────────────────────
      // Find which sets contain a card with this number + total.
      //   1 candidate  -> uniquely identified, no symbol scan needed.
      //   2+ candidates -> compare symbol only against those few sets.
      //   0 candidates -> OCR likely failed; try global symbol scan as last resort.
      let matchedSetId: string | null = null;
      let candidateSetIds: string[] = [];

      if (parsedNumber !== null) {
        try {
          const candidates = await utils.card.findByOcr.fetch({
            number: parsedNumber,
            ...(parsedTotal !== null ? { setTotal: parsedTotal } : {}),
          });
          candidateSetIds = [
            ...new Set(
              candidates
                .map((c) => (c as { set?: { id?: string } }).set?.id)
                .filter((id): id is string => !!id),
            ),
          ];
        } catch {
          // DB unavailable — continue without candidates
        }
      }

      pushStep({
        kind: "text",
        label: `Candidate sets: ${candidateSetIds.length}`,
        text:
          candidateSetIds.length > 0 ? candidateSetIds.join(", ") : "(none)",
        description:
          candidateSetIds.length === 1
            ? `Number ${parsedNumber}/${parsedTotal} uniquely identifies set "${candidateSetIds[0]}". Symbol scan skipped.`
            : candidateSetIds.length > 1
              ? `Number ${parsedNumber}/${parsedTotal} exists in ${candidateSetIds.length} sets: ${candidateSetIds.join(", ")}. Symbol scan will pick the right one.`
              : `No DB match for number ${parsedNumber ?? "?"}/${parsedTotal ?? "?"}. Falling back to global symbol scan.`,
      });

      if (candidateSetIds.length === 1) {
        // Uniquely identified — done, no symbol work needed.
        matchedSetId = candidateSetIds[0]!;
      } else if (symbolHashMap.current.size > 0) {
        const isGlobal = candidateSetIds.length === 0;

        // Infer era group from the candidate sets (for the symbol crop fallback
        // when no per-set position is available).
        const candidateGroupId = (() => {
          for (const id of candidateSetIds) {
            const series = setSeriesMap.current.get(id);
            if (series) {
              const gId = SERIES_TO_SCAN_GROUP[series];
              if (gId) return gId;
            }
          }
          return undefined;
        })();
        const symActiveGroup = candidateGroupId
          ? SYMBOL_POSITION_GROUPS.find((g) => g.id === candidateGroupId)
          : undefined;

        if (!isGlobal) {
          // ── Targeted per-set symbol scan ─────────────────────────────────
          // For each candidate set, crop the card at that set's specific known
          // symbol position (from SET_SYMBOL_POSITIONS), then compare 1:1 with
          // its reference fingerprint.  This is far more accurate than scanning
          // one generic region and diffing against all candidates at once.
          const scored: SymbolMatch[] = [];
          const cropsBySetId = new Map<string, string>();

          for (const candidateSetId of candidateSetIds) {
            const entry = symbolHashMap.current.get(candidateSetId);
            if (!entry) continue;

            // Determine the most specific crop we can use for this set.
            const pos = SET_SYMBOL_POSITIONS[candidateSetId];
            let cropX: number, cropY: number, cropW: number, cropH: number;

            if (pos && pos.x2 - pos.x1 >= 0.01) {
              // Use the empirically measured position with generous padding so
              // minor alignment differences in the photo are tolerated.
              const padX = 0.02,
                padY = 0.015;
              cropX = Math.max(0, pos.x1 - padX);
              cropY = Math.max(0, pos.y1 - padY);
              cropW = Math.min(1 - cropX, pos.x2 - pos.x1 + 2 * padX);
              cropH = Math.min(1 - cropY, pos.y2 - pos.y1 + 2 * padY);
            } else if (symActiveGroup) {
              // Fall back to era-level group region.
              ({
                x: cropX,
                y: cropY,
                w: cropW,
                h: cropH,
              } = symActiveGroup.region);
            } else {
              // Last-resort: generic centre-right strip.
              const fb = SYMBOL_REGIONS[0];
              cropX = fb.x;
              cropY = fb.y;
              cropW = fb.w;
              cropH = fb.h;
            }

            const symCrop = cropImage(cardSource, cropX, cropY, cropW, cropH);
            const symBin = binarize(symCrop, 2, false);
            // Only apply the left-exclusion fraction when the crop starts far
            // enough left that the card number could appear in it.
            const rightStartFrac = cropX > 0.35 ? 0 : 0.35;
            const symNorm = isolateSymbol(symBin, rightStartFrac);
            const hash = imgFingerprint(symNorm);
            const distance = cosineDistance(hash, entry.hash);

            scored.push({
              setId: candidateSetId,
              symbolUrl: entry.symbolUrl,
              distance,
            });
            cropsBySetId.set(candidateSetId, symNorm.toDataURL());
          }

          scored.sort((a, b) => a.distance - b.distance);
          const top = scored[0];
          if (top) matchedSetId = top.setId;

          pushStep({
            kind: "symbol-match",
            label: `Symbol: per-set scan (${scored.length} candidate${scored.length === 1 ? "" : "s"})`,
            description: `Each candidate cropped at its specific known symbol position. Closest match wins.`,
            cropDataUrl: matchedSetId
              ? (cropsBySetId.get(matchedSetId) ?? "")
              : "",
            matches: scored.slice(0, 5),
            winnerSetId: matchedSetId,
          });
        } else {
          // ── Global fallback symbol scan ───────────────────────────────────
          // No DB candidates at all (number OCR failed).  Scan using era regions
          // in priority order, compare one fingerprint against every set.
          const symbolRegionsToScan: ReadonlyArray<{
            label: string;
            x: number;
            y: number;
            w: number;
            h: number;
          }> = symActiveGroup
            ? [
                {
                  label: `Focused: ${symActiveGroup.label}`,
                  ...symActiveGroup.region,
                },
                ...SYMBOL_REGIONS,
              ]
            : [...SYMBOL_REGIONS];

          let bestStep: Omit<SymbolMatchStep, "stepNumber"> | null = null;
          for (const region of symbolRegionsToScan) {
            if (matchedSetId !== null) break;

            const symCrop = cropImage(
              cardSource,
              region.x,
              region.y,
              region.w,
              region.h,
            );
            const symBin = binarize(symCrop, 2, false);
            const symNorm = isolateSymbol(symBin, 0.35);
            const hash = imgFingerprint(symNorm);

            const scored: SymbolMatch[] = Array.from(
              symbolHashMap.current.entries(),
            )
              .map(([setId, { hash: refHash, symbolUrl }]) => ({
                setId,
                symbolUrl,
                distance: cosineDistance(hash, refHash),
              }))
              .sort((a, b) => a.distance - b.distance)
              .slice(0, 5);

            const top = scored[0];
            const winner =
              top && top.distance <= SYMBOL_DISTANCE_THRESHOLD
                ? top.setId
                : null;

            if (
              !bestStep ||
              (top && top.distance < (bestStep.matches[0]?.distance ?? 1))
            ) {
              bestStep = {
                kind: "symbol-match",
                label: `Symbol: global fallback — ${region.label}`,
                description: `No DB candidates. Comparing against all ${symbolHashMap.current.size} sets (threshold ≤ ${SYMBOL_DISTANCE_THRESHOLD}).`,
                cropDataUrl: symNorm.toDataURL(),
                matches: scored,
                winnerSetId: winner,
              };
            }
            if (winner) matchedSetId = winner;
          }
          if (bestStep) pushStep(bestStep);
        }
      }

      pushStep({
        kind: "parsed",
        label: "Parsed values",
        number: parsedNumber,
        numberError,
        total: parsedTotal,
        description: matchedSetId
          ? candidateSetIds.length === 1
            ? `Number uniquely identified set "${matchedSetId}". DB lookup: setId + number.`
            : `Symbol scan resolved set to "${matchedSetId}". DB lookup: setId + number.`
          : `Could not identify set. DB lookup: number + total (may return multiple candidates).`,
      });

      setOcrResult({ parsedNumber, parsedTotal, matchedSetId });
    } finally {
      setIsScanning(false);
    }
  }

  function handleSampleClick(sample: Sample) {
    if (!sample.imageLarge) return;
    setActiveSample(sample);
    setActiveImage(sample.imageLarge);
    // Auto-select the debugger group matching this card's series.
    const gId = SERIES_TO_SCAN_GROUP[sample.setSeries];
    if (gId) {
      const g = NUMBER_POSITION_GROUPS.find((g) => g.id === gId);
      if (g) {
        setDebugGroupId(g.id);
        setDebugRegion({ ...g.region });
      }
    }
    void runOcr(sample.imageLarge, gId ?? undefined);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setActiveSample(null);
    setActiveImage(url);
    void runOcr(url);
  }

  function handleCameraCapture(file: File) {
    const url = URL.createObjectURL(file);
    setCameraOpen(false);
    setActiveSample(null);
    setActiveImage(url);
    void runOcr(url);
  }

  return (
    <div className="space-y-8">
      {/* Symbol index status */}
      {symbolsTotal > 0 && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          {symbolsLoaded < symbolsTotal ? (
            <>
              <span className="animate-pulse">●</span>
              Loading symbol index… {symbolsLoaded} / {symbolsTotal}
            </>
          ) : (
            <>
              <span className="text-green-500">●</span>
              Symbol index ready — {symbolsLoaded} sets
            </>
          )}
        </div>
      )}

      {/* jscanify / OpenCV status */}
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        {jscanifyReady ? (
          <>
            <span className="text-green-500">●</span>
            Perspective correction ready (jscanify + OpenCV)
          </>
        ) : (
          <>
            <span className="animate-pulse">●</span>
            Loading OpenCV for perspective correction…
          </>
        )}
      </div>

      {/* Sample grid */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Sample cards — click to scan</h2>
          <select
            value={sampleFilter}
            onChange={(e) =>
              setSampleFilter(e.target.value as ScanGroupId | "all")
            }
            className="text-xs border rounded px-1 py-0.5 bg-background"
          >
            <option value="all">All sets</option>
            {NUMBER_POSITION_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {samplesQuery.isFetching
            ? Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="relative rounded aspect-2.5/3.5 bg-muted animate-pulse"
                />
              ))
            : filteredSamples.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSampleClick(s)}
                  className="relative rounded overflow-hidden border-2 border-transparent hover:border-primary transition-all aspect-2.5/3.5 bg-muted"
                  title={`${s.name} — ${s.setName}`}
                >
                  {s.imageLarge && (
                    <Image
                      src={s.imageLarge}
                      alt={s.name}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  )}
                </button>
              ))}
        </div>
      </section>

      {/* Upload / camera */}
      <section className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          Upload your own image
        </Button>
        {hasCameraSupport && (
          <Button variant="outline" onClick={() => setCameraOpen(true)}>
            <Camera className="h-4 w-4 mr-2" />
            Take photo
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </section>

      {cameraOpen && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setCameraOpen(false)}
        />
      )}

      {/* Crop debugger */}
      {activeImage && (
        <section className="border rounded-lg p-4 space-y-4">
          <button
            className="text-sm font-semibold flex items-center gap-2"
            onClick={() => setDebugOpen((o) => !o)}
          >
            <span>{debugOpen ? "▼" : "▶"}</span> Crop debugger
          </button>

          {debugOpen && (
            <div className="space-y-4">
              {/* Group selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Era group:
                </span>
                <select
                  value={debugGroupId}
                  onChange={(e) => {
                    const g = NUMBER_POSITION_GROUPS.find(
                      (g) => g.id === e.target.value,
                    );
                    if (g) {
                      setDebugGroupId(g.id);
                      setDebugRegion({ ...g.region });
                    }
                  }}
                  className="text-xs border rounded px-1 py-0.5 bg-background"
                >
                  {NUMBER_POSITION_GROUPS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sliders */}
              {(["x", "y", "w", "h"] as const).map((key) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs font-mono w-4">{key}</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.001}
                    value={debugRegion[key]}
                    onChange={(e) =>
                      setDebugRegion((r) => ({
                        ...r,
                        [key]: parseFloat(e.target.value),
                      }))
                    }
                    className="flex-1"
                  />
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.001}
                    value={debugRegion[key]}
                    onChange={(e) =>
                      setDebugRegion((r) => ({
                        ...r,
                        [key]: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-20 text-xs font-mono border rounded px-1 py-0.5"
                  />
                </div>
              ))}

              {/* Live crop preview */}
              {debugCropUrl && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Crop preview (binarized):
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={debugCropUrl}
                    alt="crop preview"
                    className="max-h-16 rounded border"
                  />
                </div>
              )}

              {/* Test OCR button */}
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void runDebugOcr()}
                  disabled={debugOcrRunning}
                >
                  {debugOcrRunning ? "Running…" : "Test OCR on this crop"}
                </Button>
                {debugOcrText !== null && (
                  <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                    {debugOcrText}
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground font-mono select-all">
                {`{ x: ${debugRegion.x}, y: ${debugRegion.y}, w: ${debugRegion.w}, h: ${debugRegion.h} }`}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Results */}
      {activeImage && (
        <section className="grid md:grid-cols-[auto_1fr] gap-8 items-start">
          {/* Scanned card — click to zoom */}
          <button
            className="relative w-36 aspect-2.5/3.5 rounded overflow-hidden border cursor-zoom-in shrink-0"
            onClick={() =>
              setZoomImage({ src: activeImage, alt: "Scanned card" })
            }
          >
            <Image
              src={activeImage}
              alt="Scanned card"
              fill
              unoptimized
              className="object-cover"
            />
          </button>

          {/* Step-by-step pipeline */}
          <div className="space-y-5">
            {scanSteps.map((step) => (
              <StepRow
                key={step.stepNumber}
                step={step}
                onZoom={(src, alt) => setZoomImage({ src, alt })}
              />
            ))}

            {isScanning && (
              <p className="text-sm text-muted-foreground animate-pulse pl-7">
                Processing…
              </p>
            )}

            {/* DB lookup — rendered as the final step once OCR is done */}
            {ocrResult && !isScanning && (
              <div className="space-y-2">
                <StepHeader
                  number={scanSteps.length + 1}
                  label="Database lookup"
                  description={`DB lookup: number "${ocrResult.parsedNumber ?? "—"}", set total ${ocrResult.parsedTotal ?? "—"}${ocrResult.matchedSetId ? `, set "${ocrResult.matchedSetId}"` : ""}. Returns up to 10 matches.`}
                />
                <div className="pl-7">
                  {lookupQuery.isLoading && (
                    <p className="text-sm text-muted-foreground">Looking up…</p>
                  )}
                  {lookupQuery.data?.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No matches found.
                    </p>
                  )}
                  {lookupQuery.data && lookupQuery.data.length > 0 && (
                    <div className="space-y-2">
                      {(
                        lookupQuery.data as Array<{
                          id: string;
                          name: string;
                          number: string;
                          imageSmall: string | null;
                          imageLarge: string | null;
                          set?: { name: string };
                        }>
                      ).map((card) => (
                        <div
                          key={card.id}
                          className="flex items-center gap-3 p-2 rounded border bg-background"
                        >
                          {card.imageLarge && (
                            <button
                              className="cursor-zoom-in shrink-0"
                              onClick={() =>
                                setZoomImage({
                                  src: card.imageLarge!,
                                  alt: card.name,
                                })
                              }
                            >
                              <Image
                                src={card.imageSmall ?? card.imageLarge}
                                alt={card.name}
                                width={40}
                                height={56}
                                unoptimized
                                className="rounded"
                              />
                            </button>
                          )}
                          <div>
                            <p className="font-medium">{card.name}</p>
                            <p className="text-sm text-muted-foreground">
                              #{card.number} — {card.set?.name}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Accuracy badge — only shown when scanning a known sample card */}
                  {activeSample &&
                    lookupQuery.data &&
                    !lookupQuery.isLoading &&
                    (() => {
                      const matches = lookupQuery.data as Array<{
                        id: string;
                        name: string;
                        number: string;
                      }>;
                      const expectedId = activeSample.id;
                      const hit = matches.some((c) => c.id === expectedId);
                      const score = !hit
                        ? 0
                        : matches[0]?.id === expectedId
                          ? 100
                          : Math.round(
                              (1 -
                                matches.findIndex((c) => c.id === expectedId) /
                                  matches.length) *
                                100,
                            );
                      return (
                        <div
                          className={`mt-3 p-3 rounded-lg border text-sm font-semibold ${
                            score === 100
                              ? "bg-green-500/10 border-green-500 text-green-600"
                              : score > 0
                                ? "bg-yellow-500/10 border-yellow-500 text-yellow-600"
                                : "bg-red-500/10 border-red-500 text-red-600"
                          }`}
                        >
                          {score === 100 &&
                            `✓ Correct card found as first match (100%)`}
                          {score > 0 &&
                            score < 100 &&
                            `~ Correct card found but not first (${score}%)`}
                          {score === 0 &&
                            `✗ Correct card not found in results (0%)`}
                          <span className="block font-normal text-xs mt-0.5 opacity-70">
                            Expected: {activeSample.name} #{activeSample.number}
                            /{activeSample.setTotal}
                          </span>
                        </div>
                      );
                    })()}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {zoomImage && (
        <CardImageDialog
          large={zoomImage.src}
          alt={zoomImage.alt}
          open
          onOpenChange={(open) => !open && setZoomImage(null)}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepHeader({
  number,
  label,
  description,
}: {
  number: number;
  label: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
          {number}
        </span>
        <p className="font-semibold text-sm">{label}</p>
      </div>
      <p className="text-xs text-muted-foreground pl-7">{description}</p>
    </div>
  );
}

function StepRow({
  step,
  onZoom,
}: {
  step: ScanStep;
  onZoom: (src: string, alt: string) => void;
}) {
  return (
    <div className="space-y-2">
      <StepHeader
        number={step.stepNumber}
        label={step.label}
        description={step.description}
      />
      <div className="pl-7">
        {step.kind === "image" && (
          <button
            className="cursor-zoom-in"
            onClick={() => onZoom(step.dataUrl, step.label)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={step.dataUrl}
              alt={step.label}
              className={
                step.size === "card"
                  ? "max-h-48 w-auto rounded border"
                  : "max-h-16 w-auto rounded border"
              }
            />
          </button>
        )}
        {step.kind === "text" && (
          <pre className="text-xs font-mono bg-muted p-3 rounded whitespace-pre-wrap break-all">
            {step.text}
          </pre>
        )}
        {step.kind === "parsed" && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant={step.number ? "default" : "destructive"}>
                Number: {step.number ?? "—"}
              </Badge>
              <Badge variant={step.total !== null ? "default" : "secondary"}>
                Set total: {step.total ?? "—"}
              </Badge>
            </div>
            {step.numberError && (
              <div className="space-y-1">
                {step.numberError && (
                  <p className="text-xs text-destructive">
                    <span className="font-semibold">Number error:</span>{" "}
                    {step.numberError}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        {step.kind === "symbol-match" && (
          <div className="space-y-2">
            {/* Cropped symbol region */}
            <button
              className="cursor-zoom-in"
              onClick={() => onZoom(step.cropDataUrl, "Symbol region crop")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={step.cropDataUrl}
                alt="Symbol region"
                className="max-h-12 w-auto rounded border"
              />
            </button>
            {/* Top matches table */}
            <div className="space-y-1">
              {step.matches.map((m, i) => (
                <div
                  key={m.setId}
                  className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${
                    m.setId === step.winnerSetId
                      ? "bg-green-500/10 border border-green-500"
                      : "bg-muted"
                  }`}
                >
                  <span className="font-mono w-4 text-muted-foreground">
                    {i + 1}.
                  </span>
                  {/* Reference symbol thumbnail */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.symbolUrl}
                    alt={m.setId}
                    className="h-5 w-5 object-contain"
                  />
                  <span className="font-medium">{m.setId}</span>
                  <Badge
                    variant={
                      m.distance <= SYMBOL_DISTANCE_THRESHOLD
                        ? "default"
                        : "secondary"
                    }
                    className="ml-auto text-[10px] py-0 h-4"
                  >
                    d={m.distance.toFixed(3)}
                  </Badge>
                </div>
              ))}
            </div>
            {step.winnerSetId ? (
              <p className="text-xs text-green-600 font-semibold">
                ✓ Matched set: {step.winnerSetId}
              </p>
            ) : (
              <p className="text-xs text-destructive">
                No confident match (best distance &gt;{" "}
                {SYMBOL_DISTANCE_THRESHOLD.toFixed(2)})
              </p>
            )}
          </div>
        )}
        {step.kind === "region-scan" && (
          <div className="space-y-2">
            {step.attempts.map((attempt, i) => (
              <div
                key={i}
                className={`rounded border p-2 ${
                  attempt.matched
                    ? "border-green-500 bg-green-500/5"
                    : "border-border bg-muted/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    className="cursor-zoom-in shrink-0"
                    onClick={() => onZoom(attempt.dataUrl, attempt.region)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attempt.dataUrl}
                      alt={attempt.region}
                      className="max-h-10 w-auto rounded border"
                    />
                  </button>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs font-semibold ${
                          attempt.matched
                            ? "text-green-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {attempt.matched ? "✓" : "✗"} {attempt.region}
                      </span>
                      {attempt.matchedPattern && (
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 h-4"
                        >
                          {attempt.matchedPattern}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground truncate">
                      {attempt.confText || attempt.rawText || "(no text)"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Loads a URL into an HTMLImageElement, resolving once it's ready.
 * crossOrigin defaults to true because all images drawn to a canvas
 * (symbol hashing, OCR) require CORS headers. Pass false only
 * for display-only images that are never drawn to a canvas. */
function loadImage(src: string, crossOrigin = true): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Renders the entire image onto a canvas at its natural size. */
function cropFull(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d")!.drawImage(img, 0, 0);
  return canvas;
}

/** Crops a proportional region from an image or canvas at 1:1 scale. */
function cropImage(
  source: HTMLImageElement | HTMLCanvasElement,
  xRatio: number,
  yRatio: number,
  wRatio: number,
  hRatio: number,
): HTMLCanvasElement {
  const sw =
    source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const sh =
    source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const sx = Math.round(sw * xRatio);
  const sy = Math.round(sh * yRatio);
  const cw = Math.round(sw * wRatio);
  const ch = Math.round(sh * hRatio);

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  canvas.getContext("2d")!.drawImage(source, sx, sy, cw, ch, 0, 0, cw, ch);
  return canvas;
}

/**
 * Find the bounding box of dark pixels (value < 128) in a binarized canvas,
 * optionally restricted to the right portion of the canvas (to skip the
 * card number on the left side of the info strip).
 * Returns null when no dark pixels are found.
 */
function findDarkBounds(
  canvas: HTMLCanvasElement,
  rightStartFrac = 0,
): { x: number; y: number; w: number; h: number } | null {
  const { data, width, height } = canvas
    .getContext("2d")!
    .getImageData(0, 0, canvas.width, canvas.height);
  const startX = Math.floor(width * rightStartFrac);
  let minX = width,
    maxX = 0,
    minY = height,
    maxY = 0,
    found = false;
  for (let y = 0; y < height; y++) {
    for (let x = startX; x < width; x++) {
      if ((data[(y * width + x) * 4] ?? 255) < 128) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }
  return found
    ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
    : null;
}

/**
 * Crops a binarized canvas to the bounding box of its dark pixels, pads it
 * to a square, and returns the result on a white background.  This makes
 * the symbol fill the entire 32×32 grid when fingerprinted, rather than
 * occupying just a few pixels inside a larger noisy crop.
 */
function isolateSymbol(
  binarized: HTMLCanvasElement,
  rightStartFrac = 0,
): HTMLCanvasElement {
  const bounds = findDarkBounds(binarized, rightStartFrac);
  if (!bounds) return binarized; // nothing found — return as-is

  const pad = Math.max(2, Math.round(Math.max(bounds.w, bounds.h) * 0.08));
  const size = Math.max(bounds.w, bounds.h) + pad * 2;
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);
  // Centre the bounding-box content
  const dx = Math.floor((size - bounds.w) / 2) - bounds.x;
  const dy = Math.floor((size - bounds.h) / 2) - bounds.y;
  ctx.drawImage(binarized, dx, dy);
  return out;
}

/**
 * Image fingerprint — resizes to 32×32, converts to grayscale, and returns
 * the 1024 pixel values normalised to the range [0, 1].  This gives 16× more
 * information than a 64-bit dHash and preserves actual shape detail.
 */
function imgFingerprint(source: HTMLCanvasElement): number[] {
  const SIZE = 32;
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  c.getContext("2d")!.drawImage(source, 0, 0, SIZE, SIZE);
  const { data } = c.getContext("2d")!.getImageData(0, 0, SIZE, SIZE);
  const pixels: number[] = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    const idx = i * 4;
    const gray =
      0.299 * (data[idx] ?? 0) +
      0.587 * (data[idx + 1] ?? 0) +
      0.114 * (data[idx + 2] ?? 0);
    pixels.push(gray / 255);
  }
  return pixels;
}

/**
 * Cosine distance between two fingerprint vectors (0 = identical, 1 = opposite).
 * Invariant to overall brightness, so a darker scan still matches a bright reference.
 */
function cosineDistance(a: number[], b: number[]): number {
  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    magA += (a[i] ?? 0) ** 2;
    magB += (b[i] ?? 0) ** 2;
  }
  if (magA === 0 || magB === 0) return 1;
  return 1 - dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Upscales a canvas by `scale`, converts to grayscale, then binarises it:
 * every pixel becomes either pure black or pure white.
 *
 * - invert=false (default): dark text on light background  (most standard cards)
 * - invert=true:            light text on dark background  (holo / full art)
 */
function binarize(
  source: HTMLCanvasElement,
  scale: number,
  invert: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width * scale;
  canvas.height = source.height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = Math.round(
      0.299 * (d[i] ?? 0) + 0.587 * (d[i + 1] ?? 0) + 0.114 * (d[i + 2] ?? 0),
    );
    // invert=false: pixels darker than threshold are text (→ black), rest → white
    // invert=true : pixels brighter than threshold are text (→ black), rest → white
    const isText = invert ? gray > 140 : gray < 140;
    const val = isText ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = val;
    d[i + 3] = 255; // fully opaque
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Upscales a canvas by `scale`, converts to grayscale and boosts contrast
 * so Tesseract can read small text reliably.
 */
function applyProcessing(
  source: HTMLCanvasElement,
  scale = 3,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width * scale;
  canvas.height = source.height * scale;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    // Grayscale
    const gray =
      0.299 * (d[i] ?? 0) + 0.587 * (d[i + 1] ?? 0) + 0.114 * (d[i + 2] ?? 0);
    // Contrast stretch: push toward black/white
    const contrasted = Math.min(255, Math.max(0, (gray - 128) * 1.8 + 128));
    d[i] = d[i + 1] = d[i + 2] = contrasted;
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas;
}
