"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CARD_BORDER_RADIUS } from "@/lib/card-config";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type CardImageDialogProps = {
  large: string;
  alt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CardImageDialog({
  large,
  alt,
  open,
  onOpenChange,
}: CardImageDialogProps) {
  const [naturalSize, setNaturalSize] = useState<{
    w: number;
    h: number;
  } | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Reset zoom when dialog closes
  useEffect(() => {
    if (!open) setIsZoomed(false);
  }, [open]);

  // After zooming in, scroll so the image center is visible
  useEffect(() => {
    if (!isZoomed) return;
    requestAnimationFrame(() => {
      const el = scrollContainerRef.current;
      if (!el) return;
      el.scrollTo({
        top: (el.scrollHeight - el.clientHeight) / 2,
        left: (el.scrollWidth - el.clientWidth) / 2,
        behavior: "instant",
      });
    });
  }, [isZoomed]);

  const isZoomable =
    naturalSize != null &&
    (naturalSize.w > window.innerWidth || naturalSize.h > window.innerHeight);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-screen h-screen bg-black/50 p-0 sm:max-w-none border-none overflow-hidden"
        style={{ borderRadius: 0 }}
      >
        <DialogTitle className="sr-only">Big image</DialogTitle>
        {/* Scroll container — overflow-auto in zoomed mode, hidden otherwise */}
        <div
          ref={scrollContainerRef}
          className={cn(
            "w-full h-full",
            isZoomed ? "overflow-auto" : "overflow-hidden",
          )}
        >
          {/*
           * Inner centering wrapper.
           * - Non-zoomed: fills the viewport exactly so max-h/w-full on
           *   the image constrains it correctly.
           * - Zoomed: at least viewport-sized so flex centering applies
           *   when the image fits; grows with the image when it overflows,
           *   making the full image reachable via scroll.
           */}
          <div
            className={cn(
              "flex items-center justify-center",
              isZoomed ? "min-w-full min-h-full" : "w-full h-full",
            )}
            onClick={(e) => {
              if (e.target === e.currentTarget) onOpenChange(false);
            }}
          >
            <Image
              src={large}
              alt={alt}
              width={600}
              height={825}
              unoptimized
              onLoad={(e) => {
                const img = e.currentTarget;
                setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
              }}
              onClick={() => {
                if (isZoomable) setIsZoomed((z) => !z);
              }}
              className={cn(
                "w-auto h-auto object-contain",
                !isZoomed && "max-h-full max-w-full",
                isZoomable && (isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"),
              )}
              style={{ borderRadius: CARD_BORDER_RADIUS }}
              draggable={false}
              priority
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
