"use client";

/**
 * ScanTester — OCR-based card recognition tool
 *
 * How it works:
 *
 * 0. jscanify (OpenCV.js) detects the card boundary in the image:
 *    a. Edge detection (Canny) + contour finding → largest contour = card
 *    b. Corner point extraction → perspective warp to a flat, straight card
 *
 * 1. The corrected image is split into two targeted strips:
 *    - Top 12%  → where the card name always appears
 *    - Bottom 15% → where the card number (e.g. "025/165") always appears,
 *                   whether it is in the bottom-left or bottom-right corner
 *
 * 2. Each strip is prepared for OCR:
 *    - First cropped at 1:1 scale so the raw region is visible
 *    - Then upscaled (3–4×), converted to grayscale and contrast-boosted
 *
 * 3. Tesseract.js reads both processed strips:
 *    - Bottom strip uses PSM 6 (block mode) to handle varying layouts
 *    - Top strip uses PSM 7 (single-line mode) for the card name
 *
 * 4. The raw text is parsed:
 *    - Number/total: regex looks for the "NNN/NNN" pattern, tolerating
 *      OCR noise on the slash character ( / \ | )
 *    - Name: lines are cleaned, noise words are filtered, and the longest
 *      remaining line is chosen as the most likely card name
 *
 * 5. The parsed values (name, number, set total) are sent to the
 *    `card.findByOcr` tRPC endpoint, which does a fuzzy word-by-word
 *    DB lookup and returns matching cards.
 *
 * 6. Each step is rendered visually as it completes so the user can
 *    follow the full pipeline in real time.
 */

import { api } from "@/lib/api/react";
import { CardImageDialog } from "@/components/card-image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { useRef, useState } from "react";
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
  parsedName: string | null;
  parsedNumber: string | null;
  parsedTotal: number | null;
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
  name: string | null;
  number: string | null;
  total: number | null;
  description: string;
};

type ScanStep = ImageStep | TextStep | ParsedStep;

// Distributes Omit over each member of the union so discriminants are preserved
type ScanStepInput =
  | Omit<ImageStep, "stepNumber">
  | Omit<TextStep, "stepNumber">
  | Omit<ParsedStep, "stepNumber">;

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
  const [isScanning, setIsScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [scanSteps, setScanSteps] = useState<ScanStep[]>([]);
  const [zoomImage, setZoomImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lookupQuery = api.card.findByOcr.useQuery(
    {
      name: ocrResult?.parsedName ?? undefined,
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

      // ── Name strip ──────────────────────────────────────────────────────

      const nameCrop = cropImage(cardSource, 0, 0, 1, 0.12);
      pushStep({
        kind: "image",
        label: "Crop: name strip (top 12%)",
        dataUrl: nameCrop.toDataURL(),
        description:
          "The Pokémon name is always in the top 12% of the card. This region is isolated first at its natural resolution.",
      });

      const nameProcessed = applyProcessing(nameCrop, 3);
      pushStep({
        kind: "image",
        label: "Process: upscale 3× · grayscale · contrast boost",
        dataUrl: nameProcessed.toDataURL(),
        description:
          "The strip is upscaled 3× so Tesseract can read small text, then converted to grayscale and contrast-stretched (factor 1.8) so the text stands out from the artwork.",
      });

      // ── Number strip ────────────────────────────────────────────────────

      const numberCrop = cropImage(cardSource, 0, 0.85, 1, 0.15);
      pushStep({
        kind: "image",
        label: "Crop: number strip (bottom 15%)",
        dataUrl: numberCrop.toDataURL(),
        description:
          'The card number (e.g. "025/165") is always in the bottom 15%, whether in the bottom-left or bottom-right corner depending on the card era.',
      });

      const numberProcessed = applyProcessing(numberCrop, 4);
      pushStep({
        kind: "image",
        label: "Process: upscale 4× · grayscale · contrast boost",
        dataUrl: numberProcessed.toDataURL(),
        description:
          "Upscaled 4× (one more than the name strip) because the number text tends to be smaller. Same grayscale and contrast processing applies.",
      });

      // ── OCR ─────────────────────────────────────────────────────────────

      const worker = await createWorker("eng");

      await worker.setParameters({ tessedit_pageseg_mode: "6" as never });
      const numberResult = await worker.recognize(numberProcessed);
      pushStep({
        kind: "text",
        label: "Tesseract OCR: number strip (PSM 6 — block mode)",
        text: numberResult.data.text || "(no text detected)",
        description:
          "Raw text output from Tesseract on the number strip. Block mode (PSM 6) handles the number appearing in different corners across card eras.",
      });

      await worker.setParameters({ tessedit_pageseg_mode: "7" as never });
      const nameResult = await worker.recognize(nameProcessed);
      pushStep({
        kind: "text",
        label: "Tesseract OCR: name strip (PSM 7 — single-line mode)",
        text: nameResult.data.text || "(no text detected)",
        description:
          "Raw text output from Tesseract on the name strip. Single-line mode (PSM 7) is more accurate when exactly one line of text is expected.",
      });

      await worker.terminate();

      // ── Parse ────────────────────────────────────────────────────────────

      // Extract NNN/NNN — tolerates OCR noise on the slash character
      const numberMatch = numberResult.data.text.match(
        /(\d{1,4})\s*[/\\|]\s*(\d{1,4})/,
      );
      const parsedNumber: string | null = numberMatch?.[1] ?? null;
      const parsedTotal = numberMatch?.[2]
        ? parseInt(numberMatch[2], 10)
        : null;

      // Pick the longest clean line from the name strip, ignoring noise
      const ignoredPatterns = /©|illus|hp|\bex\b|\bv\b/i;
      const parsedName: string | null =
        nameResult.data.text
          .split("\n")
          .map((l) => l.replace(/[^a-zA-Z0-9 '\-éè]/g, "").trim())
          .filter((l) => l.length > 2 && !ignoredPatterns.test(l))
          .sort((a, b) => b.length - a.length)[0] ?? null;

      pushStep({
        kind: "parsed",
        label: "Parsed values",
        name: parsedName,
        number: parsedNumber,
        total: parsedTotal,
        description:
          'Number/total: regex finds the "NNN/NNN" pattern, tolerating OCR noise on the slash ( / \\ | ). Name: lines are cleaned, noise words filtered (©, illus, HP, ex, v), and the longest remaining line wins.',
      });

      setOcrResult({ parsedName, parsedNumber, parsedTotal });
    } finally {
      setIsScanning(false);
    }
  }

  function handleSampleClick(sample: Sample) {
    if (!sample.imageLarge) return;
    setActiveImage(sample.imageLarge);
    void runOcr(sample.imageLarge);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setActiveImage(url);
    void runOcr(url);
  }

  return (
    <div className="space-y-8">
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
                  description={`Fuzzy word-by-word search for name "${ocrResult.parsedName ?? "—"}", number "${ocrResult.parsedNumber ?? "—"}", set total ${ocrResult.parsedTotal ?? "—"}. Returns up to 10 matches.`}
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
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Zoom dialog */}
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
          <div className="flex flex-wrap gap-2">
            <Badge variant={step.name ? "default" : "secondary"}>
              Name: {step.name ?? "—"}
            </Badge>
            <Badge variant={step.number ? "default" : "secondary"}>
              Number: {step.number ?? "—"}
            </Badge>
            <Badge variant={step.total !== null ? "default" : "secondary"}>
              Set total: {step.total ?? "—"}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Loads a URL into an HTMLImageElement, resolving once it's ready. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
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
      0.299 * (d[i] ?? 0) +
      0.587 * (d[i + 1] ?? 0) +
      0.114 * (d[i + 2] ?? 0);
    // Contrast stretch: push toward black/white
    const contrasted = Math.min(255, Math.max(0, (gray - 128) * 1.8 + 128));
    d[i] = d[i + 1] = d[i + 2] = contrasted;
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas;
}
