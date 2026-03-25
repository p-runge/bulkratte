"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CARD_BORDER_RADIUS } from "@/lib/card-config";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useEffect, useState } from "react";

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

  // Reset zoom when dialog closes
  useEffect(() => {
    if (!open) setIsZoomed(false);
  }, [open]);

  // naturalSize is null until the image loads in the browser, so window is
  // only accessed client-side (never during SSR).
  const isZoomable =
    naturalSize != null &&
    (naturalSize.w > window.innerWidth || naturalSize.h > window.innerHeight);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "w-screen h-screen bg-black/50 p-0 sm:max-w-none border-none",
          isZoomed
            ? "overflow-auto grid place-items-center"
            : "flex items-center justify-center overflow-hidden",
        )}
        style={{ borderRadius: 0 }}
        onClick={(e) => {
          // Close when clicking outside the image
          if (e.target === e.currentTarget) {
            onOpenChange(false);
          }
        }}
      >
        <DialogTitle className="sr-only">Big image</DialogTitle>
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
      </DialogContent>
    </Dialog>
  );
}
