"use client";

import { type CoverCrop } from "@/components/cover-crop-editor";
import { useCallback, useRef, useState } from "react";

interface CroppedCardImageProps {
  src: string;
  alt: string;
  crop: CoverCrop;
  className?: string;
}

/**
 * Renders a photo cropped to a specific region, filling the parent container.
 * Crop values are in natural image pixels (as stored in the DB).
 * Uses an onLoad handler to compute pixel-accurate CSS positioning.
 */
export function CroppedCardImage({
  src,
  alt,
  crop,
  className,
}: CroppedCardImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgStyle, setImgStyle] = useState<React.CSSProperties>({
    position: "absolute",
    // Initial approximation using percentage trick — corrected after load
    width: `${(1 / (crop.width || 1)) * 100}%`,
    left: `${(-crop.x / (crop.width || 1)) * 100}%`,
    top: 0,
  });

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      const container = containerRef.current;
      if (!container) return;

      const { naturalWidth: nW, naturalHeight: nH } = img;
      const containerW = container.offsetWidth;
      const containerH = container.offsetHeight;

      // Scale: make the crop region (crop.width × crop.height natural px) fill the container
      const scaleX = containerW / crop.width;
      const scaleY = containerH / crop.height;
      // Use the scale that fills the container without distortion (they should be equal
      // when the crop aspect ratio matches the container; use scaleX as primary)
      const scale = scaleX;

      const imgW = nW * scale;
      const imgH = nH * scale;
      const offsetX = -crop.x * scale;
      const offsetY = -crop.y * scale;

      setImgStyle({
        position: "absolute",
        width: `${imgW}px`,
        height: `${imgH}px`,
        left: `${offsetX}px`,
        top: `${offsetY}px`,
      });
    },
    [crop],
  );

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className ?? "w-full h-full"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onLoad={handleLoad}
        style={imgStyle}
        className="max-w-none"
        draggable={false}
      />
    </div>
  );
}
