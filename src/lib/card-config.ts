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

/** Corner radius as a fraction of the card's width. */
export const CARD_CORNER_RADIUS = 0.031; // 0.78" ≈ 3.1% of card width (2.5") ≈ 7.6px at 245px

/**
 * CSS `border-radius` value using the `X% / Y%` syntax.
 *
 * A plain percentage (e.g. `border-radius: 5%`) uses X% of *width* for the
 * horizontal radius and X% of *height* for the vertical radius, producing
 * slightly elliptical corners on non-square elements. The two-value form
 * `X% / Y%` keeps both radii equal in pixels at any rendered size:
 *
 *   x = CARD_CORNER_RADIUS × width
 *   y = CARD_CORNER_RADIUS × (width/height) × height = CARD_CORNER_RADIUS × width  ✓
 */
export const CARD_BORDER_RADIUS =
  `${CARD_CORNER_RADIUS * 100}% / ${(((CARD_CORNER_RADIUS * CARD_IMAGE_WIDTH) / CARD_IMAGE_HEIGHT) * 100).toFixed(4)}%` as const;
// = "5% / 3.5714%"
