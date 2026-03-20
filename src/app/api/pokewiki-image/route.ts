// Proxy route for fetching card images from Pokewiki, Pokezentrum and pokemonkarte.de.
// Required because these sites block direct hotlinking and CORS from the browser.
// Usage: /api/pokewiki-image?url=https%3A%2F%2Fwww.pokewiki.de%2Fimages%2F...

const ALLOWED_HOSTS: Record<string, string> = {
  "pokewiki.de": "https://www.pokewiki.de/",
  "pokezentrum.de": "https://www.pokezentrum.de/",
  "pokemonkarte.de": "https://www.pokemonkarte.de/",
  "s3.cardmarket.com": "https://www.cardmarket.com/",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return new Response("Missing url param", { status: 400 });
  }

  // Only allow requests to known card-image hosts to prevent open proxy abuse
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return new Response("Invalid url param", { status: 400 });
  }

  const referer = Object.entries(ALLOWED_HOSTS).find(([suffix]) =>
    parsed.hostname.endsWith(suffix),
  )?.[1];

  if (!referer) {
    return new Response("URL not allowed", { status: 403 });
  }

  try {
    const imageRes = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Bulkratte/1.0 (card image proxy)",
        Referer: referer,
      },
      // Ensure the upstream response is not cached by Vercel Edge unexpectedly
      cache: "no-store",
    });

    if (!imageRes.ok) {
      return new Response("Failed to fetch image from upstream host", {
        status: imageRes.status,
      });
    }

    const buffer = await imageRes.arrayBuffer();

    return new Response(buffer, {
      headers: {
        "Content-Type": imageRes.headers.get("Content-Type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=604800, immutable", // 7 days
      },
    });
  } catch {
    return new Response("Internal error fetching image", { status: 502 });
  }
}
