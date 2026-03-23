// Proxy route for fetching card images from third-party sources.
// Prevents the user's browser from directly connecting to external pages and transferring user data.
// Usage: /api/image?url=https%3A%2F%2Fwww.pokewiki.de%2Fimages%2F...

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

  const hostname = parsed.hostname.toLowerCase();
  const referer = Object.entries(ALLOWED_HOSTS).find(([suffix]) => {
    const normalizedSuffix = suffix.toLowerCase();
    return (
      hostname === normalizedSuffix || hostname.endsWith(`.${normalizedSuffix}`)
    );
  })?.[1];

  if (!referer) {
    return new Response("URL not allowed", { status: 403 });
  }

  try {
    const imageRes = await fetch(imageUrl);

    if (!imageRes.ok) {
      return new Response("Failed to fetch image from upstream host", {
        status: imageRes.status,
      });
    }

    const contentType = imageRes.headers.get("Content-Type");
    if (!contentType || !contentType.toLowerCase().startsWith("image/")) {
      return new Response("Upstream resource is not an image", { status: 415 });
    }

    const buffer = await imageRes.arrayBuffer();

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, immutable", // 7 days
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Internal error fetching image", { status: 500 });
  }
}
