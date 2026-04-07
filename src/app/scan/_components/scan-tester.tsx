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

import { CardImageDialog } from "@/components/card-image";
import { CameraCapture } from "@/components/camera-capture";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useJscanify } from "@/hooks/use-jscanify";
import { CARD_ASPECT_RATIO } from "@/lib/card-config";
import { Camera } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createWorker } from "tesseract.js";

type ImageStep = {
  kind: "image";
  stepNumber: number;
  label: string;
  dataUrl: string;
  description: string;
  /** "card" renders taller; "strip" renders short. Default: "strip" */
  size?: "card" | "strip";
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

type ScanStep = ImageStep | RegionScanStep;

// Distributes Omit over each member of the union so discriminants are preserved
type ScanStepInput =
  | Omit<ImageStep, "stepNumber">
  | Omit<RegionScanStep, "stepNumber">;

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

/**
 * Stricter subset of NUMBER_PATTERNS for live camera scanning.
 * - No standalone pattern (any single digit would match — too noisy).
 * - Standard pattern requires ≥2 digits on each side.
 * - Promo prefix requires ≥3 digit suffix to avoid short noise hits.
 * Total < 10 is rejected in the scan loop.
 */
const LIVE_NUMBER_PATTERNS: typeof NUMBER_PATTERNS = [
  {
    label: "Trainer Gallery (TG01/TG30)",
    re: /TG\s*(\d{2})\s*[\/\\|]\s*TG\s*(\d{2})/i,
    extract: (m) => ({ number: `TG${m[1]}`, total: parseInt(m[2]!, 10) }),
  },
  {
    label: "Alternate Art (GG01/GG70)",
    re: /GG\s*(\d{2})\s*[\/\\|]\s*GG\s*(\d{2})/i,
    extract: (m) => ({ number: `GG${m[1]}`, total: parseInt(m[2]!, 10) }),
  },
  {
    label: "Modern Promo (SWSH001, SV001 …)",
    re: /\b(SWSH|BW|XY|SM|SV|SVP)\s*-?\s*(\d{3,4})\b/i,
    extract: (m) => ({ number: `${m[1]!.toUpperCase()}${m[2]}`, total: null }),
  },
  {
    label: "Standard (025/165)",
    re: /\b(\d{2,4})\s*[\/\\|]\s*(\d{2,4})\b/,
    extract: (m) => ({ number: m[1]!, total: parseInt(m[2]!, 10) }),
  },
];

export function ScanTester() {
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanSteps, setScanSteps] = useState<ScanStep[]>([]);
  const [zoomImage, setZoomImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [hasCameraSupport, setHasCameraSupport] = useState(false);

  // ── Live OCR state ────────────────────────────────────────────────────────
  type TesseractWorker = Awaited<ReturnType<typeof createWorker>>;
  const [liveCardNumber, setLiveCardNumber] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<"loading" | "scanning" | "off">("off");
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const liveWorkerRef = useRef<TesseractWorker | null>(null);
  const liveAnalyzingRef = useRef(false);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Debounce: require the same result 2× before showing; clear after 3 consecutive misses
  const liveCandidateRef = useRef<{ num: string; hits: number } | null>(null);
  const liveMissCountRef = useRef(0);

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

  // ── Live OCR loop (runs while camera is open) ────────────────────────────
  useEffect(() => {
    if (!cameraOpen) {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
      void liveWorkerRef.current?.terminate();
      liveWorkerRef.current = null;
      liveAnalyzingRef.current = false;
      liveVideoRef.current = null;
      liveCandidateRef.current = null;
      liveMissCountRef.current = 0;
      setLiveCardNumber(null);
      setLiveStatus("off");
      return;
    }
    setLiveStatus("loading");

    let cancelled = false;
    void (async () => {
      // PSM 11 = sparse text — finds isolated numbers anywhere in the crop.
      // Set once and never switch mid-run (switching PSM between frames is unreliable).
      const worker = await createWorker("eng");
      await worker.setParameters({
        tessedit_pageseg_mode: "11" as never,
        tessedit_char_whitelist: "0123456789/TGHSWBXYMVP" as never,
      });
      if (cancelled) {
        await worker.terminate();
        return;
      }
      liveWorkerRef.current = worker;
      setLiveStatus("scanning");

      liveIntervalRef.current = setInterval(() => {
        const video = liveVideoRef.current;
        if (!video || video.videoWidth === 0 || liveAnalyzingRef.current) return;
        liveAnalyzingRef.current = true;
        void (async () => {
          try {
            // Capture a local reference — the ref may be nulled by cleanup mid-flight
            const worker = liveWorkerRef.current;
            if (!worker) return;

            // Capture current frame
            const frameCanvas = document.createElement("canvas");
            frameCanvas.width = video.videoWidth;
            frameCanvas.height = video.videoHeight;
            frameCanvas.getContext("2d")!.drawImage(video, 0, 0);

            // Attempt perspective correction — if successful, crop the exact number strip
            let cardCanvas: HTMLCanvasElement | null = null;
            try {
              const targetH = frameCanvas.height;
              const targetW = Math.round(targetH * CARD_ASPECT_RATIO);
              const extracted = jscanifyScanner.current?.extractPaper(
                frameCanvas,
                targetW,
                targetH,
              );
              if (extracted) cardCanvas = extracted;
            } catch {
              // OpenCV not loaded or no card outline detected — fall through
            }

            // With correction: tight bottom strip where the number always lives.
            // Without: scan the full frame — card could be anywhere and the number
            // strip is only ~2% of the card height so cropping blind wastes it.
            const crop = cardCanvas
              ? cropImage(cardCanvas, 0.03, 0.905, 0.94, 0.09)
              : frameCanvas;
            const processed = applyProcessing(crop, cardCanvas ? 3 : 1);
            const result = await worker.recognize(processed);
            // If the worker was terminated while we were awaiting, discard result
            if (liveWorkerRef.current !== worker) return;

            // Prefer confidence-filtered words (≥60%) to reduce noise
            type TWord = { text: string; confidence: number };
            type TLine = { words: TWord[] };
            type TData = { lines: TLine[] };
            const words: TWord[] =
              (result.data as unknown as TData).lines?.flatMap((l) => l.words) ?? [];
            const confText = words
              .filter((w) => w.confidence >= 60)
              .map((w) => w.text)
              .join(" ");
            const text = confText || (result.data.text?.trim() ?? "");

            let found: string | null = null;
            for (const pattern of LIVE_NUMBER_PATTERNS) {
              const m = text.match(pattern.re);
              if (m) {
                const e = pattern.extract(m);
                // Extra guard: standard pattern total must be realistic
                if (e.total !== null && e.total < 10) break;
                found = e.total !== null ? `${e.number}/${e.total}` : e.number;
                break;
              }
            }

            // Debounce: only surface a result after 2 consecutive identical hits;
            // only clear the display after 3 consecutive misses (avoids flicker).
            if (found) {
              liveMissCountRef.current = 0;
              if (liveCandidateRef.current?.num === found) {
                liveCandidateRef.current.hits++;
                if (liveCandidateRef.current.hits >= 2) setLiveCardNumber(found);
              } else {
                liveCandidateRef.current = { num: found, hits: 1 };
              }
            } else {
              liveMissCountRef.current++;
              if (liveMissCountRef.current >= 3) {
                liveCandidateRef.current = null;
                setLiveCardNumber(null);
              }
            }
          } catch {
            // Swallow errors (e.g. worker terminated mid-recognition)
          } finally {
            liveAnalyzingRef.current = false;
          }
        })();
      }, 600);
    })();

    return () => {
      cancelled = true;
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
      void liveWorkerRef.current?.terminate();
      liveWorkerRef.current = null;
      liveAnalyzingRef.current = false;
      liveVideoRef.current = null;
      liveCandidateRef.current = null;
      liveMissCountRef.current = 0;
      setLiveCardNumber(null);
      setLiveStatus("off");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen]);

  // ── jscanify (perspective correction) ────────────────────────────────────
  const { scanner: jscanifyScanner } = useJscanify();

  async function runOcr(imageUrl: string) {
    setIsScanning(true);
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
      const currentScanner = jscanifyScanner.current;

      // ── Step 1: Raw image with card boundary overlay ───────────────────────
      if (currentScanner) {
        try {
          const highlighted = currentScanner.highlightPaper(img, {
            color: "#00ff00",
            thickness: 4,
          });
          pushStep({
            kind: "image",
            label: "Card boundary detection",
            dataUrl: highlighted.toDataURL(),
            description:
              "Raw image with jscanify card boundary overlaid (green polygon). If no boundary was detected, the image is shown unmodified.",
            size: "card",
          });
        } catch (e) {
          pushStep({
            kind: "image",
            label: "Card boundary detection (error)",
            dataUrl: cropFull(img).toDataURL(),
            description: `Detection failed: ${e instanceof Error ? e.message : String(e)}. Showing raw image.`,
            size: "card",
          });
        }
      } else {
        pushStep({
          kind: "image",
          label: "Card boundary detection (OpenCV loading…)",
          dataUrl: cropFull(img).toDataURL(),
          description:
            "OpenCV is still loading. Showing raw image without boundary overlay.",
          size: "card",
        });
      }

      // ── Step 2: Perspective-corrected card ────────────────────────────────
      let cardSource: HTMLImageElement | HTMLCanvasElement = img;

      if (currentScanner) {
        try {
          const targetH = img.naturalHeight;
          const targetW = Math.round(targetH * CARD_ASPECT_RATIO);
          const corrected = currentScanner.extractPaper(img, targetW, targetH);

          if (corrected) {
            cardSource = corrected;
            pushStep({
              kind: "image",
              label: "Perspective correction",
              dataUrl: corrected.toDataURL(),
              description: `Card warped to ${targetW}×${targetH}px. All subsequent region crops use this corrected image.`,
              size: "card",
            });
          } else {
            pushStep({
              kind: "image",
              label: "Perspective correction: no boundary found",
              dataUrl: cropFull(img).toDataURL(),
              description:
                "No clear card outline detected (clean scan or flat image). Using original image for OCR.",
              size: "card",
            });
          }
        } catch (e) {
          pushStep({
            kind: "image",
            label: "Perspective correction (error)",
            dataUrl: cropFull(img).toDataURL(),
            description: `Correction failed: ${e instanceof Error ? e.message : String(e)}. Using original image.`,
            size: "card",
          });
        }
      } else {
        pushStep({
          kind: "image",
          label: "Perspective correction (OpenCV loading…)",
          dataUrl: cropFull(img).toDataURL(),
          description:
            "OpenCV is still loading. Skipping perspective correction.",
          size: "card",
        });
      }

      // ── Step 3: Number region OCR + pattern validation ────────────────────
      type TWord = { text: string; confidence: number };
      type TLine = { words: TWord[] };
      type TData = { lines: TLine[] };

      const worker = await createWorker("eng");
      await worker.setParameters({ tessedit_pageseg_mode: "6" as never });

      const regionAttempts: RegionScanAttempt[] = [];

      const regionsToScan: ReadonlyArray<{
        label: string;
        description: string;
        x: number;
        y: number;
        w: number;
        h: number;
      }> = [
        ...NUMBER_POSITION_GROUPS.map((g) => ({
          label: g.label,
          description: `Card layout: ${g.label}`,
          ...g.region,
        })),
      ];

      for (const region of regionsToScan) {
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
        let matchedPatternLabel: string | undefined;
        for (const pattern of NUMBER_PATTERNS) {
          const m = confText.match(pattern.re) ?? rawText.match(pattern.re);
          if (m) {
            matched = true;
            matchedPatternLabel = pattern.label;
            break;
          }
        }

        regionAttempts.push({
          region: region.label,
          dataUrl: regionProcessed.toDataURL(),
          rawText,
          confText,
          matched,
          matchedPattern: matchedPatternLabel,
        });
      }

      await worker.terminate();

      pushStep({
        kind: "region-scan",
        label: "Number regions: OCR + pattern validation",
        description:
          "All era-specific layouts and generic fallbacks scanned. Each crop is binarized and sent to Tesseract. Confidence-filtered text (≥70%) is validated first, then raw OCR.",
        attempts: regionAttempts,
      });
    } finally {
      setIsScanning(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setActiveImage(url);
    void runOcr(url);
  }

  function handleCameraCapture(file: File) {
    const url = URL.createObjectURL(file);
    setCameraOpen(false);
    setActiveImage(url);
    void runOcr(url);
  }

  return (
    <div className="space-y-8">
      {/* Upload / camera */}
      <section className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          Upload image
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
          onVideoReady={(v) => {
            liveVideoRef.current = v;
          }}
          overlayContent={
            liveCardNumber ? (
              <span className="bg-black/80 text-white text-sm font-mono font-bold px-4 py-2 rounded-full border border-green-400/60 shadow-lg">
                {liveCardNumber}
              </span>
            ) : liveStatus === "loading" ? (
              <span className="bg-black/60 text-white/70 text-xs px-3 py-1.5 rounded-full animate-pulse">
                Initializing scanner…
              </span>
            ) : liveStatus === "scanning" ? (
              <span className="bg-black/60 text-white/70 text-xs px-3 py-1.5 rounded-full animate-pulse">
                Scanning for ID…
              </span>
            ) : null
          }
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

      {/* Scan steps */}
      {activeImage && (
        <section className="space-y-5">
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
