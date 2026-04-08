"use client";

import { Button } from "@/components/ui/button";
import { useJscanify } from "@/hooks/use-jscanify";
import { CARD_ASPECT_RATIO, CARD_FRAME_INSET } from "@/lib/card-config";
import { Camera, Frame, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";

type Props = {
  onCapture: (file: File) => void;
  onClose: () => void;
  onVideoReady?: (video: HTMLVideoElement) => void;
  overlayContent?: React.ReactNode;
  /** Normalised region [0-1] on the corrected card to highlight as the scan target. */
  scanRegion?: { x: number; y: number; w: number; h: number };
  /** When true, the circular capture button is hidden. */
  hideCaptureButton?: boolean;
  /** Called whenever the scan-region zoom canvas is updated with the new dataURL, or null when the card is lost. */
  onZoomUpdate?: (dataUrl: string | null) => void;
};

type Corners = {
  topLeftCorner: { x: number; y: number };
  topRightCorner: { x: number; y: number };
  bottomLeftCorner: { x: number; y: number };
  bottomRightCorner: { x: number; y: number };
};

/** Draws either the detected card polygon or the static guide onto the overlay canvas.
 *  If scanRegion is provided, also draws a red highlight over that normalised region. */
function drawOverlay(
  canvas: HTMLCanvasElement,
  corners: Corners | null,
  frameInset: number,
  scanRegion?: { x: number; y: number; w: number; h: number },
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (corners) {
    const {
      topLeftCorner: tl,
      topRightCorner: tr,
      bottomRightCorner: br,
      bottomLeftCorner: bl,
    } = corners;

    // Dark background outside the detected card
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Cut out the card area
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // Green border
    const lw = Math.max(3, canvas.width / 200);
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.strokeStyle = "rgba(74,222,128,0.95)";
    ctx.lineWidth = lw;
    ctx.stroke();

    // Corner dots
    const dotR = Math.max(6, canvas.width / 110);
    for (const pt of [tl, tr, br, bl]) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, dotR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(74,222,128,1)";
      ctx.fill();
    }

    // Red scan-region highlight — bilinear-mapped onto the detected card quad
    if (scanRegion) {
      const { x: rx, y: ry, w: rw, h: rh } = scanRegion;
      const bilerp = (u: number, v: number) => ({
        x:
          (1 - u) * (1 - v) * tl.x +
          u * (1 - v) * tr.x +
          u * v * br.x +
          (1 - u) * v * bl.x,
        y:
          (1 - u) * (1 - v) * tl.y +
          u * (1 - v) * tr.y +
          u * v * br.y +
          (1 - u) * v * bl.y,
      });
      const pts = [
        bilerp(rx, ry),
        bilerp(rx + rw, ry),
        bilerp(rx + rw, ry + rh),
        bilerp(rx, ry + rh),
      ];
      ctx.beginPath();
      ctx.moveTo(pts[0]!.x, pts[0]!.y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
      ctx.closePath();
      ctx.strokeStyle = "rgba(255,50,50,0.95)";
      ctx.lineWidth = Math.max(2, canvas.width / 250);
      ctx.stroke();
    }
  } else {
    // Static card-shape guide
    const inset = frameInset / 100;
    const padX = canvas.width * inset;
    const padY = canvas.height * inset;
    const areaW = canvas.width - 2 * padX;
    const areaH = canvas.height - 2 * padY;

    // Fit a card rectangle (5:7) inside the inset area
    let cW: number, cH: number;
    if (areaW / areaH <= CARD_ASPECT_RATIO) {
      cW = areaW;
      cH = areaW / CARD_ASPECT_RATIO;
    } else {
      cH = areaH;
      cW = areaH * CARD_ASPECT_RATIO;
    }
    const cX = (canvas.width - cW) / 2;
    const cY = (canvas.height - cH) / 2;
    const r = cW * 0.031;

    // Dark background outside the card guide
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.roundRect(cX, cY, cW, cH, r);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // White guide border
    ctx.beginPath();
    ctx.roundRect(cX, cY, cW, cH, r);
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = Math.max(2, canvas.width / 300);
    ctx.stroke();

    // Red scan-region highlight mapped onto the static guide rect
    if (scanRegion) {
      ctx.strokeStyle = "rgba(255,50,50,0.95)";
      ctx.lineWidth = Math.max(2, canvas.width / 250);
      ctx.strokeRect(
        cX + scanRegion.x * cW,
        cY + scanRegion.y * cH,
        scanRegion.w * cW,
        scanRegion.h * cH,
      );
    }
  }
}

export function CameraCapture({
  onCapture,
  onClose,
  onVideoReady,
  overlayContent,
  scanRegion,
  hideCaptureButton,
  onZoomUpdate,
}: Props) {
  const intl = useIntl();
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const detectedCornersRef = useRef<Corners | null>(null);
  // Keep a ref so redrawOverlay always reads the latest value without becoming a dependency
  const scanRegionRef = useRef(scanRegion);
  useEffect(() => {
    scanRegionRef.current = scanRegion;
  }, [scanRegion]);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [cardDetected, setCardDetected] = useState(false);
  const [videoDims, setVideoDims] = useState<{ w: number; h: number } | null>(
    null,
  );
  const zoomCanvasRef = useRef<HTMLCanvasElement>(null);

  const { scanner, ready: jscanifyReady } = useJscanify();

  // ── Camera stream ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        if (!cancelled) {
          setError(
            intl.formatMessage({
              id: "camera.error.access_denied",
              defaultMessage: "Camera access denied or unavailable.",
            }),
          );
        }
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [intl]);

  // ── Redraw overlay whenever corners or showOverlay changes ─────────────────
  const redrawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    if (!showOverlay) {
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    drawOverlay(
      canvas,
      detectedCornersRef.current,
      CARD_FRAME_INSET,
      scanRegionRef.current,
    );
  }, [showOverlay]);

  // ── Live card-detection loop ───────────────────────────────────────────────
  useEffect(() => {
    if (!jscanifyReady || !ready) {
      // Draw static guide while jscanify loads
      redrawOverlay();
      return;
    }

    const intervalId = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || video.paused) return;

      if (!offscreenRef.current) {
        offscreenRef.current = document.createElement("canvas");
      }
      const offscreen = offscreenRef.current;
      offscreen.width = video.videoWidth;
      offscreen.height = video.videoHeight;
      const ctx = offscreen.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);

      let found = false;
      try {
        const cv = (
          window as unknown as {
            cv: { imread: (c: HTMLCanvasElement) => unknown };
          }
        ).cv;
        const src = cv.imread(offscreen);
        const contour = scanner.current?.findPaperContour(src);
        (src as { delete(): void }).delete();

        if (contour) {
          const corners = scanner.current?.getCornerPoints(contour);
          if (
            corners?.topLeftCorner &&
            corners?.topRightCorner &&
            corners?.bottomLeftCorner &&
            corners?.bottomRightCorner
          ) {
            detectedCornersRef.current = corners as Corners;
            found = true;

            // ── Zoom canvas: extract scan region from the raw video frame ──
            const sr = scanRegionRef.current;
            const zoomCanvas = zoomCanvasRef.current;
            if (sr && zoomCanvas) {
              const {
                topLeftCorner: tl,
                topRightCorner: tr,
                bottomRightCorner: br,
                bottomLeftCorner: bl,
              } = corners as Corners;
              const bilerp = (u: number, v: number) => ({
                x:
                  (1 - u) * (1 - v) * tl.x +
                  u * (1 - v) * tr.x +
                  u * v * br.x +
                  (1 - u) * v * bl.x,
                y:
                  (1 - u) * (1 - v) * tl.y +
                  u * (1 - v) * tr.y +
                  u * v * br.y +
                  (1 - u) * v * bl.y,
              });
              const pts = [
                bilerp(sr.x, sr.y),
                bilerp(sr.x + sr.w, sr.y),
                bilerp(sr.x + sr.w, sr.y + sr.h),
                bilerp(sr.x, sr.y + sr.h),
              ];
              const minX = Math.max(
                0,
                Math.floor(Math.min(...pts.map((p) => p.x))),
              );
              const minY = Math.max(
                0,
                Math.floor(Math.min(...pts.map((p) => p.y))),
              );
              const maxX = Math.min(
                offscreen.width,
                Math.ceil(Math.max(...pts.map((p) => p.x))),
              );
              const maxY = Math.min(
                offscreen.height,
                Math.ceil(Math.max(...pts.map((p) => p.y))),
              );
              const srcW = maxX - minX;
              const srcH = maxY - minY;
              if (srcW > 4 && srcH > 4) {
                // Render at 2× the source pixel width for sharpness, max 720px
                const ZOOM_W = Math.min(720, srcW * 2);
                const ZOOM_H = Math.round((ZOOM_W * srcH) / srcW);
                // Only resize if dimensions actually changed — avoids flicker
                if (
                  zoomCanvas.width !== ZOOM_W ||
                  zoomCanvas.height !== ZOOM_H
                ) {
                  zoomCanvas.width = ZOOM_W;
                  zoomCanvas.height = ZOOM_H;
                }
                const zCtx = zoomCanvas.getContext("2d")!;
                zCtx.clearRect(0, 0, ZOOM_W, ZOOM_H);
                zCtx.drawImage(
                  offscreen,
                  minX,
                  minY,
                  srcW,
                  srcH,
                  0,
                  0,
                  ZOOM_W,
                  ZOOM_H,
                );
                onZoomUpdate?.(zoomCanvas.toDataURL());
              }
            }
          }
        }
      } catch {
        // OpenCV error — skip frame
      }

      if (!found) {
        detectedCornersRef.current = null;
        // Clear zoom when card is lost
        const zCtx = zoomCanvasRef.current?.getContext("2d");
        if (zCtx)
          zCtx.clearRect(
            0,
            0,
            zoomCanvasRef.current!.width,
            zoomCanvasRef.current!.height,
          );
        onZoomUpdate?.(null);
      }

      setCardDetected(found);
      redrawOverlay();
    }, 200);

    return () => clearInterval(intervalId);
  }, [jscanifyReady, ready, scanner, redrawOverlay]);

  // Redraw when showOverlay toggles
  useEffect(() => {
    redrawOverlay();
  }, [redrawOverlay]);

  // ── Capture ────────────────────────────────────────────────────────────────
  const capture = () => {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(
          new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" }),
        );
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {/*
          The inner div sizes itself to the video's displayed dimensions.
          The overlay canvas sits absolutely on top with the same CSS size,
          so canvas pixel coordinates (in natural video space) map 1-to-1 to
          the displayed video pixels.
        */}
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onCanPlay={() => {
              const v = videoRef.current;
              if (!v) return;
              setVideoDims({ w: v.videoWidth, h: v.videoHeight });
              setReady(true);
              onVideoReady?.(v);
            }}
            style={{
              display: "block",
              maxWidth: "100vw",
              maxHeight: "calc(100vh - 100px)",
            }}
          />

          {/* Canvas overlay — same natural size as the video, scaled identically by CSS */}
          {videoDims && (
            <canvas
              ref={overlayCanvasRef}
              width={videoDims.w}
              height={videoDims.h}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          )}

          {/* Scan-region zoom loupe */}
          {scanRegion && (
            <canvas
              ref={zoomCanvasRef}
              className="absolute top-3 right-3 border-2 border-red-500 rounded shadow-lg"
              style={{
                imageRendering: "auto",
                maxWidth: "40%",
                filter: "contrast(1.2) brightness(1.05)",
              }}
            />
          )}

          {/* Live OCR card number */}
          {overlayContent && (
            <div className="absolute bottom-10 left-0 right-0 flex justify-center pointer-events-none">
              {overlayContent}
            </div>
          )}

          {/* "Card detected" badge */}
          {ready && showOverlay && cardDetected && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
              <span className="bg-green-500/85 text-white text-xs font-semibold px-3 py-1 rounded-full">
                Card detected
              </span>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <p className="text-white text-sm px-8 text-center">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="shrink-0 flex items-center justify-between px-8 py-6 bg-black">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-12 w-12 text-white hover:text-white hover:bg-white/20"
          onClick={onClose}
          aria-label={intl.formatMessage({
            id: "camera.action.cancel",
            defaultMessage: "Cancel",
          })}
        >
          <X className="h-6 w-6" />
        </Button>

        {hideCaptureButton ? (
          <div className="h-16 w-16" />
        ) : (
          <button
            type="button"
            onClick={capture}
            disabled={!ready}
            aria-label={intl.formatMessage({
              id: "camera.action.capture",
              defaultMessage: "Take photo",
            })}
            className="cursor-pointer h-16 w-16 rounded-full bg-white disabled:opacity-40 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
          >
            <Camera className="h-7 w-7 text-black" />
          </button>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-12 w-12 hover:bg-white/20 ${showOverlay ? "text-white hover:text-white" : "text-white/30 hover:text-white/50"}`}
          onClick={() => setShowOverlay((v) => !v)}
          aria-label={intl.formatMessage({
            id: "camera.action.toggle_overlay",
            defaultMessage: "Toggle card guide",
          })}
        >
          <Frame className="h-5 w-5" />
        </Button>
      </div>

      <canvas ref={captureCanvasRef} className="hidden" />
    </div>
  );
}
