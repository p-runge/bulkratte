"use client";

import { type CoverCrop } from "@/components/cover-crop-editor";

interface CroppedCardImageProps {
  src: string;
  alt: string;
  crop: CoverCrop;
  className?: string;
}

/**
 * Renders a photo cropped to a specific region, filling the parent container.
 *
 * Crop values are percentages (0–100) of the image's natural dimensions.
 * Positioning is computed entirely in CSS using percentage values, so it works
 * correctly at any container size and on any device (no JS, no onLoad timing).
 *
 * Math (all % relative to containing block):
 *   width  = (100 / crop.width)  * 100%  → fills crop region horizontally
 *   height = (100 / crop.height) * 100%  → fills crop region vertically
 *   left   = -(crop.x / crop.width)  * 100%
 *   top    = -(crop.y / crop.height) * 100%  (% of containing block HEIGHT for abs elements)
 */
export function CroppedCardImage({
  src,
  alt,
  crop,
  className,
}: CroppedCardImageProps) {
  const w = crop.width || 1;
  const h = crop.height || 1;

  return (
    <div className={`relative overflow-hidden ${className ?? "w-full h-full"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        style={{
          position: "absolute",
          width: `${10000 / w}%`,
          height: `${10000 / h}%`,
          left: `${-(crop.x / w) * 100}%`,
          top: `${-(crop.y / h) * 100}%`,
        }}
        className="max-w-none"
        draggable={false}
      />
    </div>
  );
}
