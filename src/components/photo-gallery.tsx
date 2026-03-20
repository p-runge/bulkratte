"use client";

import type { CoverCrop } from "@/components/cover-crop-editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Crop, Star, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

export interface PhotoGalleryEditActions {
  onRemove: (index: number) => void;
  onSetCover: (index: number) => void;
  onOpenCrop: (index: number) => void;
  coverCrop?: CoverCrop | null;
}

interface PhotoGalleryProps {
  photos: string[];
  coverIndex?: number | null;
  editActions?: PhotoGalleryEditActions;
  /**
   * The card's official image. Shown as the hero (and as the first selectable
   * thumbnail) whenever no cover photo has been set. Disappears from the
   * hero once a cover is chosen.
   */
  fallbackSrc?: string;
  fallbackAlt?: string;
  /** CSS aspect-ratio value for the main image container. Defaults to "5/7". */
  aspectRatio?: string;
}

/**
 * Product-style photo gallery.
 *
 * Selection index: -1 = card art (fallbackSrc), 0..n-1 = user photo.
 *
 * Hero image rules:
 * - index -1 → static card art, no lightbox, no edit actions.
 * - index = coverIndex with coverCrop → cropped view; click opens full photo
 *   in lightbox.
 * - any other user photo → full photo; click opens lightbox.
 *
 * Thumbnail strip:
 * - When no cover is set: card art thumbnail shown first (selects index -1).
 * - Cover photo always first among user photos (yellow ring).
 * - Clicking a thumbnail selects it as the active hero.
 * - Edit mode: hero shows star / crop / remove on hover; thumbnails show
 *   a remove button on hover.
 */
export function PhotoGallery({
  photos,
  coverIndex,
  editActions,
  fallbackSrc,
  fallbackAlt,
  aspectRatio = "5/7",
}: PhotoGalleryProps) {
  // -1 = showing card art (fallback); 0..n-1 = showing that user photo
  const [currentIndex, setCurrentIndex] = useState<number>(coverIndex ?? -1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Sync with cover changes: selecting a cover makes it the active display
  useEffect(() => {
    setCurrentIndex(coverIndex ?? -1);
  }, [coverIndex]);

  // When a photo is removed, keep the selection valid
  const handleRemove = (index: number) => {
    if (currentIndex === index) {
      // Go back to card art if available, else to previous photo
      setCurrentIndex(fallbackSrc ? -1 : Math.max(-1, index - 1));
    } else if (currentIndex > index) {
      setCurrentIndex(currentIndex - 1);
    }
    editActions?.onRemove(index);
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const showingCardArt = currentIndex === -1;
  const showingUserPhoto =
    currentIndex >= 0 && currentIndex < photos.length && !!photos[currentIndex];
  const currentPhoto = showingUserPhoto ? photos[currentIndex]! : undefined;
  const isCoverSelected = showingUserPhoto && currentIndex === coverIndex;
  const hasCrop = isCoverSelected && !!editActions?.coverCrop;

  // Card art thumbnail shown when no cover is explicitly set
  const showCardThumbnail = coverIndex == null && !!fallbackSrc;

  // Thumbnail order: cover first, then the rest in original order
  const sortedIndices =
    coverIndex != null && coverIndex < photos.length
      ? [coverIndex, ...photos.map((_, i) => i).filter((i) => i !== coverIndex)]
      : photos.map((_, i) => i);

  const hasHero = (showingCardArt && !!fallbackSrc) || showingUserPhoto;
  const hasThumbnailStrip = showCardThumbnail || photos.length > 0;

  return (
    <div className="space-y-2">
      {/* Hero */}
      {hasHero && (
        <div
          className={cn(
            "relative w-full rounded-md overflow-hidden bg-muted",
            showingUserPhoto && "cursor-zoom-in group",
          )}
          style={{ aspectRatio }}
          onClick={
            showingUserPhoto ? () => openLightbox(currentIndex) : undefined
          }
        >
          {showingUserPhoto && hasCrop ? (
            <CroppedPhotoView
              src={currentPhoto!}
              crop={editActions!.coverCrop!}
              alt="Cover photo"
            />
          ) : showingUserPhoto ? (
            <Image
              src={currentPhoto!}
              alt={`Photo ${currentIndex + 1}`}
              fill
              unoptimized
              className="object-contain"
            />
          ) : (
            <Image
              src={fallbackSrc!}
              alt={fallbackAlt ?? ""}
              fill
              unoptimized
              className="object-contain"
              priority
            />
          )}

          {/* Edit overlay — only on user photos */}
          {editActions && showingUserPhoto && (
            <div
              className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                variant={isCoverSelected ? "default" : "secondary"}
                size="icon"
                className="h-7 w-7 shadow"
                title="Set as cover"
                onClick={() => editActions.onSetCover(currentIndex)}
              >
                <Star
                  className="h-3 w-3"
                  fill={isCoverSelected ? "currentColor" : "none"}
                />
              </Button>
              {isCoverSelected && (
                <Button
                  type="button"
                  variant={editActions.coverCrop ? "default" : "secondary"}
                  size="icon"
                  className="h-7 w-7 shadow"
                  title="Crop cover photo"
                  onClick={() => editActions.onOpenCrop(currentIndex)}
                >
                  <Crop className="h-3 w-3" />
                </Button>
              )}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-7 w-7 shadow"
                title="Remove photo"
                onClick={() => handleRemove(currentIndex)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Thumbnail strip */}
      {hasThumbnailStrip && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {/* Card art — first thumbnail, only when no cover is set */}
          {showCardThumbnail && (
            <button
              type="button"
              className={cn(
                "relative flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                currentIndex === -1
                  ? "border-primary"
                  : "border-transparent hover:border-muted-foreground/40",
              )}
              onClick={() => setCurrentIndex(-1)}
            >
              <Image
                src={fallbackSrc!}
                alt={fallbackAlt ?? "Card"}
                fill
                unoptimized
                className="object-cover"
              />
            </button>
          )}

          {/* User photo thumbnails */}
          {sortedIndices.map((index) => (
            <button
              key={index}
              type="button"
              className={cn(
                "relative flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                currentIndex === index
                  ? "border-primary"
                  : "border-transparent hover:border-muted-foreground/40",
                coverIndex === index && "ring-2 ring-yellow-400 ring-offset-1",
              )}
              onClick={() => setCurrentIndex(index)}
            >
              <Image
                src={photos[index]!}
                alt={`Thumbnail ${index + 1}`}
                fill
                unoptimized
                className="object-cover"
              />
              {editActions && (
                <span
                  className="absolute top-0 right-0 w-4 h-4 bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-bl"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(index);
                  }}
                  title="Remove photo"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      handleRemove(index);
                    }
                  }}
                >
                  <X className="h-2 w-2" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={photos.map((src) => ({ src }))}
      />
    </div>
  );
}

/**
 * Renders a percentage-based crop of an image by scaling and offsetting the
 * image so only the crop window is visible within the parent container.
 *
 * Math: image_width = container_width × (100/crop.width)
 *       left        = container_width × -(crop.x/crop.width)
 *       (same for height/top)
 */
function CroppedPhotoView({
  src,
  crop,
  alt,
}: {
  src: string;
  crop: CoverCrop;
  alt: string;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          position: "absolute",
          maxWidth: "none",
          width: `${10000 / crop.width}%`,
          height: `${10000 / crop.height}%`,
          left: `${-(crop.x / crop.width) * 100}%`,
          top: `${-(crop.y / crop.height) * 100}%`,
        }}
      />
    </div>
  );
}
