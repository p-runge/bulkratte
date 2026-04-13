"use client";

import { CameraCapture } from "@/components/camera-capture";
import { Button } from "@/components/ui/button";
import { useJscanify } from "@/hooks/use-jscanify";
import { CARD_ASPECT_RATIO } from "@/lib/card-config";
import { ImagePipeline } from "@/lib/image-pipeline";
import { Camera } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Tesseract, { createWorker } from "tesseract.js";
import z from "zod";

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
    region: { x: 0.845, y: 0.943, w: 0.083, h: 0.017 },
  },
] as const;

/**
 * Valid card ID formats:
 * - TG/GG prefix + 2-digit number:  TG01, GG56
 * - Promo prefix + 3-digit number:  SWSH001, BW999, SVP042
 * - Bare number (no leading zero):  1, 42, 102
 * - x/y format — x may have leading zeros, y may not: 10/102, 002/102, 110/102
 */
const CardIdSchema = z
  .string()
  .trim()
  .regex(
    /^(?:(TG|GG)\d{2}|(SWSH|BW|XY|SM|SVP|SV)\d{3}|[1-9]\d{0,1}|\d{1,3}\/[1-9]\d{0,2})$/,
    // /^(\d{1,3}\/[1-9]\d{0,2})$/,
  );

/** Expansion levels tried in order when a group region yields no match. */
const LIVE_EXPANSIONS = [0] as const;
// const LIVE_EXPANSIONS = [0, 20, 50, 100] as const;
type LiveExpansion = (typeof LIVE_EXPANSIONS)[number];

/**
 * Expands a normalised region by `pct` percent outward on all sides.
 * Clamps to [0, 1] so the resulting crop never exceeds the image bounds.
 */
function expandRegion(
  r: { x: number; y: number; w: number; h: number },
  pct: number,
): { x: number; y: number; w: number; h: number } {
  const dW = r.w * (pct / 100);
  const dH = r.h * (pct / 100);
  const x = Math.max(0, r.x - dW / 2);
  const y = Math.max(0, r.y - dH / 2);
  const w = Math.min(1 - x, r.w + dW);
  const h = Math.min(1 - y, r.h + dH);
  return { x, y, w, h };
}

export function ScanTester() {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [hasCameraSupport, setHasCameraSupport] = useState(false);

  // [DEV-ONLY: delete before publishing] ─────────────────────────────────────
  // Target ID the scanner must match before auto-confirming.
  // Leave empty to confirm any valid hit (original behaviour).
  const [devTargetId, setDevTargetId] = useState("");
  // How long (in seconds) the last scan took to confirm.
  const [devScanSeconds, setDevScanSeconds] = useState<number | null>(null);
  // Timestamp (ms) recorded when the camera opens.
  const scanStartRef = useRef<number | null>(null);

  // History of confirmed scans — persisted to localStorage across reloads.
  // cropUrl is kept in memory only (data URLs are too large to store).
  type DevHistoryEntry = {
    id: string;
    times: number[]; // every confirmed scan time in seconds
    cropUrl: string | null; // in-memory only, cleared on reload
  };
  const DEV_HISTORY_KEY = "dev-scan-history";
  const [devScanHistory, setDevScanHistory] = useState<DevHistoryEntry[]>(() => {
    try {
      const raw = localStorage.getItem(DEV_HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as { id: string; times: number[] }[];
      return parsed.map((e) => ({ ...e, cropUrl: null }));
    } catch {
      return [];
    }
  });
  // Persist whenever history changes (store without cropUrl)
  useEffect(() => {
    try {
      const toStore = devScanHistory.map(({ id, times }) => ({ id, times }));
      localStorage.setItem(DEV_HISTORY_KEY, JSON.stringify(toStore));
    } catch {
      // Quota exceeded or SSR — ignore
    }
  }, [devScanHistory]);
  // ──────────────────────────────────────────────────────────────────────────

  // ── Live OCR state ────────────────────────────────────────────────────────
  type TesseractWorker = Awaited<ReturnType<typeof createWorker>>;
  const [liveCardNumber, setLiveCardNumber] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<"loading" | "scanning" | "off">(
    "off",
  );
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const liveWorkerRef = useRef<TesseractWorker | null>(null);
  const liveAnalyzingRef = useRef(false);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Expansion cycling: index into LIVE_EXPANSIONS, advances on each miss
  const liveExpansionIdxRef = useRef(0);
  const [liveTolerance, setLiveTolerance] = useState<LiveExpansion | null>(
    null,
  );
  // Currently scanned region (for overlay highlight)
  const [liveScanRegion, setLiveScanRegion] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  // ── Single-hit canvas cache + confirmed state ─────────────────────────────
  /** Data URL of the perspective-corrected card canvas (set on first hit). */
  const [liveCardCanvasUrl, setLiveCardCanvasUrl] = useState<string | null>(
    null,
  );
  /** Data URL of the processed OCR crop (set on first hit). */
  const [liveProcessedUrl, setLiveProcessedUrl] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [confirmedCropUrl, setConfirmedCropUrl] = useState<string | null>(null);

  useEffect(() => {
    setHasCameraSupport(
      typeof navigator !== "undefined" &&
        typeof navigator.mediaDevices?.getUserMedia === "function",
    );
  }, []);

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
      liveExpansionIdxRef.current = 0;
      setLiveCardNumber(null);
      setLiveTolerance(null);
      setLiveScanRegion(null);
      setLiveCardCanvasUrl(null);
      setLiveProcessedUrl(null);
      setLiveStatus("off");
      return;
    }
    setLiveStatus("loading");
    scanStartRef.current = Date.now(); // [DEV-ONLY: delete before publishing]

    let cancelled = false;
    let terminated = false; // set synchronously in cleanup; checked before/after every await

    void (async () => {
      // Set once and never switch mid-run (switching PSM between frames is unreliable).
      const worker = await createWorker("eng", Tesseract.OEM.DEFAULT, {
        // logger: (m) => console.log("[Tesseract]", m),
      });
      await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_WORD,
        tessedit_char_whitelist: "0123456789/",
        // TODO: only use numbers for now, add promo letter prefixes back in later on
        // tessedit_char_whitelist: "0123456789/TGHSWBXYMVP",
      });
      if (cancelled) {
        await worker.terminate();
        return;
      }
      liveWorkerRef.current = worker;
      setLiveStatus("scanning");

      liveIntervalRef.current = setInterval(() => {
        const video = liveVideoRef.current;
        if (!video || video.videoWidth === 0 || liveAnalyzingRef.current)
          return;
        liveAnalyzingRef.current = true;
        void (async () => {
          try {
            // Guard against cleanup having run before this tick started
            if (terminated || !worker) return;

            // Capture current frame
            const frameCanvas = document.createElement("canvas");
            frameCanvas.width = video.videoWidth;
            frameCanvas.height = video.videoHeight;
            frameCanvas.getContext("2d")!.drawImage(video, 0, 0);

            // Attempt perspective correction so group regions map correctly
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

            // ── Pick the expansion level for this tick ──────────────────────
            const expansionIdx = liveExpansionIdxRef.current;
            const expansion = LIVE_EXPANSIONS[expansionIdx] ?? 0;

            // Focus on wotc (Base Set) group for now
            // TODO: remove before publishing
            const wotcGroup = NUMBER_POSITION_GROUPS.find(
              (g) => g.id === "wotc",
            )!;
            const expandedRegion = expandRegion(wotcGroup.region, expansion);
            setLiveScanRegion(expandedRegion);

            let text = "";
            let processedCanvas: HTMLCanvasElement | null = null;
            if (cardCanvas) {
              // Crop the exact (possibly expanded) number region from the corrected card
              const crop = cropImage(
                cardCanvas,
                expandedRegion.x,
                expandedRegion.y,
                expandedRegion.w,
                expandedRegion.h,
              );
              processedCanvas = new ImagePipeline(crop)
                .scale(3)
                .greyscale()
                .blur(1)
                .sharpen(1.5)
                .contrast(0.62)
                .toCanvas();
              const result = await worker.recognize(processedCanvas);
              if (terminated) return;
              text = result.data.text?.trim() ?? "";
              // } else {
              //   // No correction: scan the full raw frame (card position unknown)
              //   const result = await worker.recognize(frameCanvas);
              //   if (terminated) return;
              //   text = result.data.text?.trim() ?? "";
            }

            let found: string | null = null;
            try {
              found = CardIdSchema.parse(text);
              console.log("Found valid card ID:", found, { text, expansion });
            } catch {
              // No valid number found in this frame
              console.log("Found text does not match expected patterns:", {
                text,
              });
            }

            // Single-hit: surface immediately and cache canvases; misses don't clear.
            if (found) {
              if (cardCanvas) setLiveCardCanvasUrl(cardCanvas.toDataURL());
              if (processedCanvas)
                setLiveProcessedUrl(processedCanvas.toDataURL());
              setLiveCardNumber(found);
              setLiveTolerance(expansion as LiveExpansion);
              liveExpansionIdxRef.current = 0;

              // [DEV-ONLY: delete before publishing] ─────────────────────────
              // If a target ID is set, auto-confirm only when we hit it exactly.
              const target = devTargetIdRef.current.trim().toUpperCase();
              const normalised = found.trim().toUpperCase();
              if (target && normalised === target) {
                const elapsed = scanStartRef.current
                  ? (Date.now() - scanStartRef.current) / 1000
                  : null;
                const cropUrl = cardCanvas ? cardCanvas.toDataURL() : null;
                setDevScanSeconds(elapsed);
                setDevTargetId(""); // clear input after match
                setDevScanHistory((prev) => {
                  const existing = prev.find((h) => h.id === found);
                  const newTimes =
                    elapsed !== null
                      ? [...(existing?.times ?? []), elapsed]
                      : (existing?.times ?? []);
                  const updated: typeof prev[number] = {
                    id: found,
                    times: newTimes,
                    cropUrl,
                  };
                  return [updated, ...prev.filter((h) => h.id !== found)];
                });
                setConfirmedId(found);
                setConfirmedCropUrl(cropUrl);
                setCameraOpen(false);
              }
              // ──────────────────────────────────────────────────────────────
            } else {
              // Cycle to next expansion level; wraps back to 0 after the last
              liveExpansionIdxRef.current =
                (expansionIdx + 1) % LIVE_EXPANSIONS.length;
            }
          } catch {
            // Swallow errors (e.g. worker terminated mid-recognition)
          } finally {
            liveAnalyzingRef.current = false;
          }
        })();
      }, 200);
    })();

    return () => {
      terminated = true; // stops any in-flight recognize() from proceeding after await
      cancelled = true;
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
      void liveWorkerRef.current?.terminate();
      liveWorkerRef.current = null;
      liveAnalyzingRef.current = false;
      liveVideoRef.current = null;
      liveExpansionIdxRef.current = 0;
      setLiveCardNumber(null);
      setLiveTolerance(null);
      setLiveScanRegion(null);
      setLiveCardCanvasUrl(null);
      setLiveProcessedUrl(null);
      setLiveStatus("off");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen]);

  // [DEV-ONLY: delete before publishing] ─────────────────────────────────────
  // Ref so the interval callback always reads the latest devTargetId without
  // needing to be recreated (avoids restarting the OCR loop on every keystroke).
  const devTargetIdRef = useRef(devTargetId);
  useEffect(() => {
    devTargetIdRef.current = devTargetId;
  }, [devTargetId]);
  // ──────────────────────────────────────────────────────────────────────────

  // ── jscanify (perspective correction) ────────────────────────────────────
  const { scanner: jscanifyScanner } = useJscanify();

  return (
    <div className="space-y-6">
      {/* [DEV-ONLY: delete before publishing] ──────────────────────────────── */}
      <section className="border border-dashed border-yellow-400/60 rounded-lg p-4 space-y-3 bg-yellow-400/5">
        <p className="text-xs font-semibold text-yellow-500 uppercase tracking-wide">
          Dev tools — remove before publishing
        </p>
        <div className="flex items-center gap-3">
          <label htmlFor="dev-target-id" className="text-xs text-muted-foreground whitespace-nowrap">
            Target ID (auto-confirm on match):
          </label>
          <input
            id="dev-target-id"
            type="text"
            value={devTargetId}
            onChange={(e) => setDevTargetId(e.target.value)}
            placeholder="e.g. 4/102"
            className="font-mono text-sm px-2 py-1 rounded border border-border bg-background w-32"
          />
          {devTargetId && (
            <button
              type="button"
              onClick={() => setDevTargetId("")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
        {/* [DEV-ONLY] Scan history — click a pill to re-use that ID as the target */}
        {devScanHistory.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Past scans (click to set as target):</p>
            <div className="flex flex-wrap gap-2">
              {devScanHistory.map((h) => {
                const avg =
                  h.times.length > 0
                    ? h.times.reduce((a, b) => a + b, 0) / h.times.length
                    : null;
                return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setDevTargetId(h.id)}
                  className="flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-full border border-border bg-background hover:bg-accent transition-colors"
                >
                  <span>{h.id}</span>
                  {avg !== null && (
                    <span className="text-muted-foreground">
                      avg {avg.toFixed(1)}s
                      {h.times.length > 1 && ` ×${h.times.length}`}
                    </span>
                  )}
                </button>
                );
              })}
            </div>
          </div>
        )}
      </section>
      {/* ─────────────────────────────────────────────────────────────────── */}

      {hasCameraSupport && (
        <Button onClick={() => setCameraOpen(true)}>
          <Camera className="h-4 w-4 mr-2" />
          Take photo
        </Button>
      )}

      {confirmedId && (
        <section className="space-y-3 pt-2">
          <p className="text-sm font-mono">
            Detected ID: <strong>{confirmedId}</strong>
          </p>
          {/* [DEV-ONLY: delete before publishing] */}
          {devScanSeconds !== null && (
            <p className="text-xs text-muted-foreground font-mono">
              Time to confirm: <strong>{devScanSeconds.toFixed(1)}s</strong>
            </p>
          )}
          {confirmedCropUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={confirmedCropUrl}
              alt="Scan region crop"
              className="max-h-24 rounded border-2 border-red-500"
            />
          )}
        </section>
      )}

      {cameraOpen && (
        <CameraCapture
          onCapture={() => {}}
          onClose={() => setCameraOpen(false)}
          onVideoReady={(v) => {
            liveVideoRef.current = v;
          }}
          scanRegion={liveScanRegion ?? undefined}
          hideCaptureButton
          overlayContent={
            liveCardNumber ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                  {liveCardCanvasUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={liveCardCanvasUrl}
                      alt="Corrected card"
                      className="max-h-32 rounded border-2 border-green-400 shadow-lg pointer-events-none"
                    />
                  )}
                  {liveProcessedUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={liveProcessedUrl}
                      alt="OCR crop"
                      className="max-h-32 rounded border-2 border-red-500 shadow-lg pointer-events-none"
                    />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="bg-black/80 text-white text-sm font-mono font-bold px-4 py-2 rounded-full border border-green-400/60 shadow-lg">
                    {liveCardNumber}
                    {liveTolerance !== null && liveTolerance > 0 && (
                      <span className="ml-2 text-[10px] font-normal opacity-60">
                        +{liveTolerance}%
                      </span>
                    )}
                  </span>
                  <Button
                    size="sm"
                    className="pointer-events-auto"
                    onClick={() => {
                      setConfirmedId(liveCardNumber);
                      setConfirmedCropUrl(liveCardCanvasUrl);
                      setCameraOpen(false);
                    }}
                  >
                    Use this ID
                  </Button>
                </div>
              </div>
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
