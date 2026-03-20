"use client";

import { Button } from "@/components/ui/button";
import { CARD_ASPECT_RATIO, CARD_BORDER_RADIUS } from "@/lib/card-config";
import { Camera, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";

type Rect = { x: number; y: number; w: number; h: number };

/** Compute the actual displayed area of an object-contain video within its container. */
function videoContentRect(
  containerW: number,
  containerH: number,
  videoW: number,
  videoH: number,
): Rect {
  const containerRatio = containerW / containerH;
  const videoRatio = videoW / videoH;
  if (videoRatio > containerRatio) {
    // video wider than container → fits width, letterboxed top/bottom
    const h = containerW / videoRatio;
    return { x: 0, y: (containerH - h) / 2, w: containerW, h };
  } else {
    // video taller → fits height, pillarboxed left/right
    const w = containerH * videoRatio;
    return { x: (containerW - w) / 2, y: 0, w, h: containerH };
  }
}

type Props = {
  onCapture: (file: File) => void;
  onClose: () => void;
};

export function CameraCapture({ onCapture, onClose }: Props) {
  const intl = useIntl();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [contentRect, setContentRect] = useState<Rect | null>(null);

  const updateContentRect = useCallback(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container || !video.videoWidth || !video.videoHeight) return;
    setContentRect(
      videoContentRect(
        container.clientWidth,
        container.clientHeight,
        video.videoWidth,
        video.videoHeight,
      ),
    );
  }, []);

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

  // Recompute content rect whenever the container is resized
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(updateContentRect);
    ro.observe(container);
    return () => ro.disconnect();
  }, [updateContentRect]);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `capture-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(file);
      },
      "image/jpeg",
      0.92,
    );
  };

  // Guide: 80% of video content width centered — matches the crop editor's default crop
  const guideRect: Rect | null = contentRect
    ? (() => {
        const gW = contentRect.w * 0.8;
        const gH = gW / CARD_ASPECT_RATIO;
        return {
          x: contentRect.x + (contentRect.w - gW) / 2,
          y: contentRect.y + (contentRect.h - gH) / 2,
          w: gW,
          h: gH,
        };
      })()
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 overflow-hidden"
      >
        {/* object-contain so the full camera frame is always visible */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={updateContentRect}
          onCanPlay={() => {
            setReady(true);
            updateContentRect();
          }}
          className="absolute inset-0 w-full h-full object-contain"
        />

        {/* Card guide — precisely positioned over the actual video content */}
        {ready && guideRect && (
          <>
            <div
              className="absolute pointer-events-none border-2 border-white/80"
              style={{
                left: guideRect.x,
                top: guideRect.y,
                width: guideRect.w,
                height: guideRect.h,
                borderRadius: CARD_BORDER_RADIUS,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
              }}
            />
            <p
              className="absolute w-full text-center text-white/70 text-xs pointer-events-none"
              style={{ top: guideRect.y + guideRect.h + 10, left: 0 }}
            >
              {intl.formatMessage({
                id: "camera.guide.position_card",
                defaultMessage: "Position card within the frame",
              })}
            </p>
          </>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <p className="text-white text-sm px-8 text-center">{error}</p>
          </div>
        )}
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

        <button
          type="button"
          onClick={capture}
          disabled={!ready}
          aria-label={intl.formatMessage({
            id: "camera.action.capture",
            defaultMessage: "Take photo",
          })}
          className="h-16 w-16 rounded-full bg-white disabled:opacity-40 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
        >
          <Camera className="h-7 w-7 text-black" />
        </button>

        <div className="w-12" />
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
