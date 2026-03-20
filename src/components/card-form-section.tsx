"use client";

import { UserCardFormFields } from "@/components/user-card-form-fields";
import {
  CARD_BORDER_RADIUS,
  CARD_IMAGE_HEIGHT,
  CARD_IMAGE_WIDTH,
} from "@/lib/card-config";
import Image from "next/image";
import type { ReactNode } from "react";
import type { Control } from "react-hook-form";

interface CardFormSectionProps {
  card: {
    imageSmall: string;
    name: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  /** Optional content rendered between the card name and the form fields */
  alert?: ReactNode;
  /** Optional content rendered after the form fields */
  children?: ReactNode;
  /**
   * Replaces the card image in the left column. Use this to render a
   * `MultiPhotoUpload` (with `fallbackSrc={card.imageSmall}`) so the left
   * side acts as a product-gallery slot. When omitted, the card image is
   * rendered as a static fallback.
   */
  mediaSlot?: ReactNode;
}

/**
 * Shared layout used in dialogs that show a card image alongside form fields.
 * Left column: mediaSlot (e.g. photo gallery + upload) or the card image.
 * Right column: card name, optional alert, language/variant/condition fields,
 * optional extra children (e.g. notes).
 */
export function CardFormSection({
  card,
  control,
  alert,
  children,
  mediaSlot,
}: CardFormSectionProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
      <div className="w-full sm:w-auto sm:max-w-60 sm:flex-shrink-0 mx-auto sm:mx-0">
        {mediaSlot ?? (
          <Image
            src={card.imageSmall}
            alt={card.name}
            width={CARD_IMAGE_WIDTH}
            height={CARD_IMAGE_HEIGHT}
            unoptimized
            className="w-full h-auto object-cover"
            draggable={false}
            priority
            style={{ borderRadius: CARD_BORDER_RADIUS }}
          />
        )}
      </div>
      <div className="flex-1 space-y-4 sm:space-y-6">
        <h2 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-4">
          {card.name}
        </h2>
        {alert}
        <UserCardFormFields control={control} />
        {children}
      </div>
    </div>
  );
}
