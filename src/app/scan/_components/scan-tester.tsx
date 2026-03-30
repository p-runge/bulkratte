"use client";

/**
 * ScanTester — OCR + symbol-matching card recognition tool
 *
 * Pipeline:
 * 0. jscanify (OpenCV.js): perspective-correct the scanned card image.
 * 1. Symbol matching: crop the set-logo region, compute a 64-bit perceptual
 *    hash (dHash), find the closest match in the pre-fetched symbol index.
 *    → Identifies the exact set with no name OCR needed.
 * 2. Number OCR: scan priority regions in the card footer for the card
 *    number (e.g. “025/165”), with a digit-whitelist fallback pass.
 * 3. Name OCR: three preprocessing variants with PSM 7 + letter whitelist.
 *    Used only as a disambiguation fallback when symbol matching is uncertain.
 * 4. DB lookup: setId (from symbol) + number (from OCR) → exact card.
 */

import { api } from "@/lib/api/react";
import { CardImageDialog } from "@/components/card-image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
};

type OcrResult = {
  parsedNumber: string | null;
  parsedTotal: number | null;
  /** Set ID resolved by symbol matching. When set, the DB query uses setId + number. */
  matchedSetId: string | null;
};

type Props = {
  samples: Sample[];
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
  /** Hamming distance 0 (identical) – 64 (opposite). */
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
/**
 * Regions where the set symbol may appear, tried in order.
 * Modern cards (SV, SWSH, SM, XY): symbol is in the bottom strip, to the
 * right of the card number.  Older sets may place it bottom-left or center.
 */
const SYMBOL_REGIONS = [
  {
    label: "Bottom-right (SV/SWSH/SM/XY)",
    x: 0.55,
    y: 0.88,
    w: 0.38,
    h: 0.1,
  },
  {
    label: "Bottom-center (BW and some older)",
    x: 0.3,
    y: 0.87,
    w: 0.6,
    h: 0.11,
  },
  {
    label: "Full bottom strip (fallback)",
    x: 0.05,
    y: 0.86,
    w: 0.9,
    h: 0.12,
  },
] as const;

/**
 * Confidence threshold: a cosine distance ≤ this value is considered a match.
 * Range 0 (identical) – 1 (completely different). 0.12 means ≥88% cosine similarity.
 */
const SYMBOL_DISTANCE_THRESHOLD = 0.12;

// ── Card number: scan regions (ordered by probability) ─────────────────────
/**
 * Regions to scan for the card number, tried in order.
 * Scanning stops at the first region where a valid pattern is found.
 */
const NUMBER_REGIONS = [
  {
    // Card number is in the bottom copyright/legal strip, BELOW the
    // weakness-resistance-retreat row (~y:0.83-0.92) and the rules text.
    // y:0.93 safely clears all card body text on standard-sized cards.
    label: "Bottom-left corner",
    description: "Most modern sets (SV, SWSH, SM, XY) print the number here.",
    x: 0,
    y: 0.93,
    w: 0.45,
    h: 0.07,
  },
  {
    label: "Bottom-right corner",
    description: "Some older sets (BW, early XY) and certain Full Art prints.",
    x: 0.5,
    y: 0.93,
    w: 0.5,
    h: 0.07,
  },
  {
    label: "Full bottom strip (fallback)",
    description:
      "Scans the entire bottom 9% when the number isn't in a corner.",
    x: 0,
    y: 0.91,
    w: 1.0,
    h: 0.09,
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

/** Module-level promise — OpenCV.js is only loaded once per page session. */
let opencvLoadPromise: Promise<void> | null = null;

function loadOpenCV(): Promise<void> {
  if (opencvLoadPromise) return opencvLoadPromise;
  opencvLoadPromise = new Promise<void>((resolve, reject) => {
    const w = window as Window & { cv?: { Mat?: unknown } };
    if (w.cv?.Mat) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "/opencv.js";
    script.async = true;
    script.onload = () => {
      // OpenCV WASM initialises asynchronously after the script loads
      const poll = () =>
        (w.cv as { Mat?: unknown } | undefined)?.Mat
          ? resolve()
          : setTimeout(poll, 50);
      poll();
    };
    script.onerror = () => reject(new Error("Failed to load OpenCV.js"));
    document.head.appendChild(script);
  });
  return opencvLoadPromise;
}

export function ScanTester({ samples }: Props) {
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [activeSample, setActiveSample] = useState<Sample | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [scanSteps, setScanSteps] = useState<ScanStep[]>([]);
  const [zoomImage, setZoomImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
              canvas.getContext("2d")!.drawImage(img, 0, 0);
              map.set(s.id, {
                hash: imgFingerprint(canvas),
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

  async function runOcr(imageUrl: string) {
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

      // ── jscanify: card detection & perspective correction ─────────────────

      await loadOpenCV();

      const { default: JscanifyClass } = await import("jscanify/client");
      const scanner = new JscanifyClass();

      // Step 1: highlight detected card boundary on the original image
      const highlightCanvas = scanner.highlightPaper(img, {
        color: "orange",
        thickness: 6,
      });
      pushStep({
        kind: "image",
        label: "jscanify: card boundary detection",
        dataUrl: highlightCanvas.toDataURL(),
        description:
          "OpenCV edge detection (Canny) finds the largest contour in the image. The detected card boundary is drawn in orange. This is what jscanify will warp into a flat rectangle.",
        size: "card",
      });

      // Step 2: perspective warp → flat, undistorted card
      const extractedCanvas = scanner.extractPaper(
        img,
        img.naturalWidth,
        img.naturalHeight,
      );
      const cardSource: HTMLImageElement | HTMLCanvasElement =
        extractedCanvas ?? img;
      pushStep({
        kind: "image",
        label: "jscanify: perspective correction",
        dataUrl: (extractedCanvas ?? cropFull(img)).toDataURL(),
        description: extractedCanvas
          ? "The four detected corners are used as control points for a perspective warp (cv.warpPerspective), producing a straight, undistorted card ready for OCR."
          : "No card boundary detected — using the original image as-is for the remaining steps.",
        size: "card",
      });

      // ── Number: scan priority regions ──────────────────────────────────────

      type TWord = { text: string; confidence: number };
      type TLine = { words: TWord[] };
      type TData = { lines: TLine[] };

      const worker = await createWorker("eng");
      await worker.setParameters({ tessedit_pageseg_mode: "6" as never });

      let parsedNumber: string | null = null;
      let parsedTotal: number | null = null;
      let numberError: string | null = null;
      const regionAttempts: RegionScanAttempt[] = [];

      for (const region of NUMBER_REGIONS) {
        // Stop as soon as we have a valid number
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

        // Confidence-filtered text used first; raw text as fallback
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
        label: "Number: scan priority regions",
        description:
          "Regions are scanned in priority order — scanning stops at the first match. Confidence-filtered text (≥70%) is tried first, raw OCR is used as fallback.",
        attempts: regionAttempts,
      });

      // ── Number fallback: digit whitelist ────────────────────────────────
      // When all regions fail (artwork noise confuses Tesseract), run the full
      // bottom strip once more with a digit+slash-only whitelist.  This strips
      // every artwork character so only meaningful digit pairs survive.
      if (parsedNumber === null) {
        const digitCrop = cropImage(cardSource, 0, 0.91, 1, 0.09);
        // Binary threshold for digits: black ink on light background.
        // Include A-Z so promo prefixes like XY, SWSH, SM survive the whitelist.
        const digitBinary = binarize(digitCrop, 4, false);
        await worker.setParameters({
          tessedit_pageseg_mode: "6" as never,
          tessedit_char_whitelist:
            "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz/ " as never,
        });
        const digitResult = await worker.recognize(digitBinary);
        const digitText = digitResult.data.text?.trim() ?? "";

        // Try standard patterns first; then a lenient two-group match for
        // when the slash was read as a space (common with digit whitelist).
        // Guard: for NNN/NNN matches, require total >= 5 to reject noise
        // like "4/4" that can appear in rules text ("takes 2 Prize cards").
        let digitMatched = false;
        for (const pattern of NUMBER_PATTERNS) {
          const m = digitText.match(pattern.re);
          if (m) {
            const extracted = pattern.extract(m);
            // Sanity: if we got a total, it must be plausible (≥5 cards in any set)
            if (extracted.total !== null && extracted.total < 5) continue;
            parsedNumber = extracted.number;
            parsedTotal = extracted.total;
            numberError = null;
            digitMatched = true;
            break;
          }
        }
        if (!digitMatched) {
          // e.g. "90 131" when slash was lost
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
            ? `Digit whitelist fallback succeeded: matched “${parsedNumber}/${parsedTotal}”.`
            : "Digit whitelist fallback found no number pattern either.",
        });

        if (!digitMatched) {
          numberError = digitText
            ? `No number pattern in digit-only pass: “${digitText.slice(0, 80)}”`
            : "No digits detected in bottom strip.";
        }
      }

      await worker.terminate();

      // ── Candidate set lookup ───────────────────────────────────────────────────
      // Query DB with number + total to find which sets contain this card.
      //   1 match  → uniquely identified, symbol scan skipped.
      //   >1 match → ambiguous, compare symbol only against those candidates.
      //   0 match  → number OCR likely wrong, fall back to global symbol scan.
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
            ? `Number ${parsedNumber}/${parsedTotal} uniquely identifies set "${candidateSetIds[0]}". Skipping symbol scan.`
            : candidateSetIds.length > 1
              ? `Number ${parsedNumber}/${parsedTotal} exists in ${candidateSetIds.length} sets: ${candidateSetIds.join(", ")}. Symbol matching will pick the right one.`
              : `No DB match for number ${parsedNumber ?? "?"}/${parsedTotal ?? "?"}. Falling back to global symbol scan.`,
      });

      if (candidateSetIds.length === 1) {
        // Unique match — no symbol scan needed
        matchedSetId = candidateSetIds[0]!;
      } else if (candidateSetIds.length > 1 && symbolHashMap.current.size > 0) {
        // ── Targeted symbol matching ─────────────────────────────────────────
        // Build a sub-map with only the ambiguous candidate sets.
        const searchTargets = new Map(
          candidateSetIds.flatMap((id) => {
            const entry = symbolHashMap.current.get(id);
            return entry ? [[id, entry] as const] : [];
          }),
        );

        if (searchTargets.size > 0) {
          let bestStep: Omit<SymbolMatchStep, "stepNumber"> | null = null;
          for (const region of SYMBOL_REGIONS) {
            if (matchedSetId !== null) break;

            const symCrop = cropImage(
              cardSource,
              region.x,
              region.y,
              region.w,
              region.h,
            );
            const symBin = binarize(symCrop, 2, false);
            const hash = imgFingerprint(symBin);

            // No threshold when comparing a known candidate set — just pick closest.
            const scored: SymbolMatch[] = Array.from(searchTargets.entries())
              .map(([setId, { hash: refHash, symbolUrl }]) => ({
                setId,
                symbolUrl,
                distance: cosineDistance(hash, refHash),
              }))
              .sort((a, b) => a.distance - b.distance);

            const winner = scored[0]?.setId ?? null;
            if (
              !bestStep ||
              (scored[0] &&
                scored[0].distance < (bestStep.matches[0]?.distance ?? 1))
            ) {
              bestStep = {
                kind: "symbol-match",
                label: `Symbol: disambiguating ${candidateSetIds.join(" vs ")}`,
                description: `Comparing symbol crop against ${searchTargets.size} candidate set(s) only. Closest match wins.`,
                cropDataUrl: symBin.toDataURL(),
                matches: scored.slice(0, 5),
                winnerSetId: winner,
              };
            }
            if (winner) matchedSetId = winner;
          }
          if (bestStep) pushStep(bestStep);
        }
      } else if (symbolHashMap.current.size > 0) {
        // ── Global symbol fallback ───────────────────────────────────────────
        // Number OCR found no DB candidates. Compare against all sets with
        // a confidence threshold as a best-effort identification.
        let bestStep: Omit<SymbolMatchStep, "stepNumber"> | null = null;
        for (const region of SYMBOL_REGIONS) {
          if (matchedSetId !== null) break;

          const symCrop = cropImage(
            cardSource,
            region.x,
            region.y,
            region.w,
            region.h,
          );
          const symBin = binarize(symCrop, 2, false);
          const hash = imgFingerprint(symBin);

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
            top && top.distance <= SYMBOL_DISTANCE_THRESHOLD ? top.setId : null;
          if (
            !bestStep ||
            (top && top.distance < (bestStep.matches[0]?.distance ?? 1))
          ) {
            bestStep = {
              kind: "symbol-match",
              label: `Symbol match (fallback) — ${region.label}`,
              description: `No DB candidates found. Comparing against all ${symbolHashMap.current.size} sets. Distance ≤ ${SYMBOL_DISTANCE_THRESHOLD} is a confident match.`,
              cropDataUrl: symBin.toDataURL(),
              matches: scored,
              winnerSetId: winner,
            };
          }
          if (winner) matchedSetId = winner;
        }
        if (bestStep) pushStep(bestStep);
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
            : `Symbol matching resolved set to "${matchedSetId}". DB lookup: setId + number.`
          : `Could not identify set. DB lookup: number + set total (may return multiple candidates).`,
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
    void runOcr(sample.imageLarge);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
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

      {/* Sample grid */}
      <section>
        <h2 className="font-semibold mb-3">Sample cards — click to scan</h2>
        <div className="grid grid-cols-5 gap-2">
          {samples.map((s) => (
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

      {/* Upload */}
      <section>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          Upload your own image
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </section>

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
 * (jscanify, symbol hashing, OCR) require CORS headers. Pass false only
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
 * Image fingerprint — resizes to 32×32, converts to grayscale, and returns
 * the 1024 pixel values normalised to the range [0, 1].  This gives 16× more
 * information than a 64-bit dHash and preserves actual shape detail rather
 * than just horizontal gradient direction.
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
