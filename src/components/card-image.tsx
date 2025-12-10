"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useState } from "react";

type CardImageProps = {
  small: string;
  large: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
};

export default function CardImage({
  small,
  large,
  alt,
  width = 64,
  height = 88,
  className = "",
}: CardImageProps) {
  const [showOverlay, setShowOverlay] = useState(false);

  return (
    <>
      <Image
        src={small}
        alt={alt}
        width={width}
        height={height}
        unoptimized
        className={cn(
          "cursor-zoom-in transition-transform hover:scale-105",
          className
        )}
        onClick={() => setShowOverlay(true)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setShowOverlay(true);
        }}
        role="button"
        aria-label="Show large card image"
      />
      <Dialog open={showOverlay} onOpenChange={setShowOverlay}>
        <DialogContent
          className="w-screen h-screen flex items-center justify-center bg-black/50 p-0 sm:max-w-none border-none"
          style={{ borderRadius: 0 }}
          onClick={(e) => {
            // Close when clicking outside the image
            if (e.target === e.currentTarget) {
              setShowOverlay(false);
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
            className="w-auto h-auto object-contain"
            draggable={false}
            priority
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
