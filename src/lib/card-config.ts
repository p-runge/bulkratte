/**
 * Central source of truth for card-related constants.
 */

/** Width-to-height aspect ratio of a card (numeric, e.g. for canvas/crop calculations).
 * The physical card size is 2.5"×3.5"
 */
export const CARD_ASPECT_RATIO = 5 / 7;

/** Tailwind CSS utility class for the card aspect ratio. */
export const CARD_ASPECT_CLASS = "aspect-5/7";

/**
 * Intrinsic pixel width used for Next.js <Image> width/height hints.
 * These are not the rendered size — they only inform the browser of the
 * image's natural aspect ratio.
 */
export const CARD_IMAGE_WIDTH = 245; // 5 × 49

/**
 * Intrinsic pixel height matching the 5:7 ratio (7 × 49 = 343).
 */
export const CARD_IMAGE_HEIGHT = 343; // 7 × 49
