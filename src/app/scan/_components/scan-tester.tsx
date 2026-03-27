"use client";

/**
 * ScanTester — OCR-based card recognition tool
 *
 * How it works:
 *
 * 1. The user picks a sample card or uploads their own image.
 *
 * 2. The image is split into two targeted strips:
 *    - Top 12%  → where the card name always appears
 *    - Bottom 15% → where the card number (e.g. "025/165") always appears,
 *                   whether it is in the bottom-left or bottom-right corner
 *
 * 3. Each strip is prepared for OCR via `prepareForOcr`:
 *    - Upscaled (3–4×) so characters are large enough for Tesseract to read
 *    - Converted to grayscale and contrast-boosted so text stands out clearly
 *
 * 4. Tesseract.js reads both strips:
 *    - Bottom strip uses PSM 6 (block mode) to handle varying layouts
 *    - Top strip uses PSM 7 (single-line mode) for the card name
 *
 * 5. The raw text is parsed:
 *    - Number/total: regex looks for the "NNN/NNN" pattern, tolerating
 *      OCR noise on the slash character ( / \ | )
 *    - Name: lines are cleaned, noise words are filtered, and the longest
 *      remaining line is chosen as the most likely card name
 *
 * 6. The parsed values (name, number, set total) are sent to the
 *    `card.findByOcr` tRPC endpoint, which does a fuzzy word-by-word
 *    DB lookup and returns matching cards.
 *
 * 7. Matches are shown with a thumbnail. Both the scanned image and any
 *    match thumbnail can be clicked to open a zoomable full-screen view.
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

export function ScanTester({ samples }: Props) {
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
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

    try {
      const img = await loadImage(imageUrl);

      // Number/total: always in the bottom strip (left or right corner).
      // 15% height covers all card eras, 4× scale + contrast for small text.
      const numberCanvas = prepareForOcr(img, 0, 0.85, 1, 0.15, 4);

      // Name: top 12% of the card — consistent across all layouts.
      const nameCanvas = prepareForOcr(img, 0, 0, 1, 0.12, 3);

      const worker = await createWorker("eng");

      await worker.setParameters({ tessedit_pageseg_mode: "6" as never });
      const numberResult = await worker.recognize(numberCanvas);

      await worker.setParameters({ tessedit_pageseg_mode: "7" as never });
      const nameResult = await worker.recognize(nameCanvas);

      await worker.terminate();

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

      setOcrResult({ parsedName, parsedNumber, parsedTotal });
    } finally {
      setIsScanning(false);
    }
  }

  function handleSampleClick(sample: Sample) {
    if (!sample.imageLarge) return;
    setActiveImage(sample.imageLarge);
    runOcr(sample.imageLarge);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setActiveImage(url);
    runOcr(url);
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

          {/* OCR results */}
          <div className="space-y-5">
            {isScanning && (
              <p className="text-sm text-muted-foreground animate-pulse">
                Scanning…
              </p>
            )}

            {ocrResult && !isScanning && (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                    Detected
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      Name: {ocrResult.parsedName ?? "—"}
                    </Badge>
                    <Badge variant="secondary">
                      Number: {ocrResult.parsedNumber ?? "—"}
                    </Badge>
                    <Badge variant="secondary">
                      Set total: {ocrResult.parsedTotal ?? "—"}
                    </Badge>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                    DB matches{" "}
                    {lookupQuery.data ? `(${lookupQuery.data.length})` : ""}
                  </p>
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
              </>
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

// ── Helpers ──────────────────────────────────────────────────────────────────

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

/**
 * Prepares a region of the card image for Tesseract:
 * - Crops the specified area (all values 0–1, proportional to image size)
 * - Scales it up by `scale` factor so Tesseract can read small text
 * - Converts to grayscale and boosts contrast so text stands out from artwork
 */
function prepareForOcr(
  img: HTMLImageElement,
  xRatio: number,
  yRatio: number,
  wRatio: number,
  hRatio: number,
  scale = 3,
): HTMLCanvasElement {
  const sx = Math.round(img.naturalWidth * xRatio);
  const sy = Math.round(img.naturalHeight * yRatio);
  const sw = Math.round(img.naturalWidth * wRatio);
  const sh = Math.round(img.naturalHeight * hRatio);

  const canvas = document.createElement("canvas");
  canvas.width = sw * scale;
  canvas.height = sh * scale;
  const ctx = canvas.getContext("2d")!;

  // Draw scaled region
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  // Apply grayscale + contrast boost via pixel manipulation
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
