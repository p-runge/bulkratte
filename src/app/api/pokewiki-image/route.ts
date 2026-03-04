// Proxy route for fetching card images from Pokewiki.
// Required because Pokewiki blocks direct hotlinking and CORS from the browser.
// Usage: /api/pokewiki-image?url=https%3A%2F%2Fwww.pokewiki.de%2Fimages%2F...

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return new Response("Missing url param", { status: 400 });
  }

  // Only allow requests to pokewiki.de to prevent open proxy abuse
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return new Response("Invalid url param", { status: 400 });
  }

  if (!parsed.hostname.endsWith("pokewiki.de")) {
    return new Response("URL not allowed", { status: 403 });
  }

  try {
    const imageRes = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Bulkratte/1.0 (card image proxy)",
        Referer: "https://www.pokewiki.de/",
      },
    });

    if (!imageRes.ok) {
      return new Response("Failed to fetch image from Pokewiki", {
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
