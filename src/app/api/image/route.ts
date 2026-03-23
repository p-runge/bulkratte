// Proxy route for fetching card images from third-party sources.
// Prevents the user's browser from directly connecting to external pages and transferring user data.
// Usage: /api/image?url=https%3A%2F%2Fwww.pokewiki.de%2Fimages%2F...

import { PROXY_HOSTS } from "@/lib/proxy-hosts";

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

  if (parsed.protocol !== "https:") {
    return new Response("Only HTTPS URLs are allowed", { status: 400 });
  }

  const hostname = parsed.hostname.toLowerCase();
  const isAllowed = PROXY_HOSTS.some((suffix) => {
    const normalizedSuffix = suffix.toLowerCase();
    return (
      hostname === normalizedSuffix || hostname.endsWith(`.${normalizedSuffix}`)
    );
  });

  if (!isAllowed) {
    return new Response("URL not allowed", { status: 403 });
  }

  try {
    const imageRes = await fetch(imageUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });

    if (!imageRes.ok) {
      return new Response("Failed to fetch image from upstream host", {
        status: imageRes.status,
      });
    }

    const contentType = imageRes.headers.get("Content-Type");
    if (!contentType || !contentType.toLowerCase().startsWith("image/")) {
      return new Response("Upstream resource is not an image", { status: 415 });
    }

    return new Response(imageRes.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, immutable", // 7 days
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return new Response("Upstream host timed out", { status: 504 });
    }
    return new Response("Internal error fetching image", { status: 500 });
  }
}
