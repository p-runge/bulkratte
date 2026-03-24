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

/** Returns true if the given hostname (or a subdomain of it) is in the proxy allowlist. */
export function isProxyHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return PROXY_HOSTS.some(
    (suffix) => lower === suffix || lower.endsWith(`.${suffix}`),
  );
}
