/**
 * Builds the app-relative URL for a card image served via /images/[...path].
 * @param cardId  - The card ID (e.g. "base1-4")
 * @param lang    - Two-letter language code (default "en")
 * @param ext     - File extension including dot (default ".webp")
 */
export function cardImageUrl(
  cardId: string,
  lang = "en",
  ext = ".webp",
): string {
  return `/images/cards/${cardId}/${lang}${ext}`;
}

/**
 * Builds the app-relative URL for a set logo or symbol.
 * @param setId   - The set ID (e.g. "base1")
 * @param asset   - "logo" or "symbol"
 * @param ext     - File extension including dot (default ".png")
 */
export function setAssetUrl(
  setId: string,
  asset: "logo" | "symbol",
  ext = ".png",
): string {
  return `/images/sets/${setId}/${asset}${ext}`;
}
