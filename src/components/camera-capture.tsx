"use client";

import { Button } from "@/components/ui/button";
import {
  CARD_ASPECT_CLASS,
  CARD_BORDER_RADIUS,
  CARD_FRAME_INSET,
  CARD_IMAGE_HEIGHT,
  CARD_IMAGE_WIDTH,
} from "@/lib/card-config";
import { cn } from "@/lib/utils";
import { Camera, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";

type Props = {
  onCapture: (file: File) => void;
  onClose: () => void;
};

export function CameraCapture({ onCapture, onClose }: Props) {
  const intl = useIntl();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

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
      <div className="flex-1 flex items-center justify-center">
        <div className="relative flex items-center justify-center m-auto">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onCanPlay={() => setReady(true)}
            className="object-contain"
          />
          {/* Card guide — centered, "contain" sizing with CARD_FRAME_INSET padding on every side */}
          {ready && (
            <div
              className="absolute flex items-center justify-center pointer-events-none"
              style={{
                inset: `${CARD_FRAME_INSET}%`,
              }}
            >
              <div
                className={cn(
                  "h-full object-contain border-2 border-white/80",
                  CARD_ASPECT_CLASS,
                )}
                style={{
                  borderRadius: CARD_BORDER_RADIUS,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                }}
              />
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
