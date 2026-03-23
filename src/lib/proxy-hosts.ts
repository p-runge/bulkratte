/**
 * Hostnames whose card images must be served via the internal /api/image proxy
 * because these sites block direct hotlinking from the browser.
 *
 * Used by both:
 *  - src/app/api/image/route.ts  (allowlist check)
 *  - src/lib/db/localization.ts  (URL rewriting)
 */
export const PROXY_HOSTS = [
  "pokewiki.de",
  "pokezentrum.de",
  "pokemonkarte.de",
  "s3.cardmarket.com",
];
