// Proxy route for fetching card images from third-party sources.
// Prevents the user's browser from directly connecting to external pages and transferring user data.
// Usage: /api/image?url=https%3A%2F%2Fwww.pokewiki.de%2Fimages%2F...

import { isProxyHost } from "@/lib/proxy-hosts";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

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

  if (!isProxyHost(parsed.hostname)) {
    return new Response("URL not allowed", { status: 403 });
  }

  try {
    const imageRes = await fetch(imageUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });

    // Re-validate the final URL after following redirects to prevent open proxy abuse.
    let finalUrl: URL;
    try {
      finalUrl = new URL(imageRes.url);
    } catch {
      return new Response("Invalid redirect URL from upstream host", {
        status: 502,
      });
    }
    if (finalUrl.protocol !== "https:") {
      return new Response("Only HTTPS URLs are allowed", { status: 400 });
    }
    if (!isProxyHost(finalUrl.hostname)) {
      return new Response("URL not allowed", { status: 403 });
    }

    if (!imageRes.ok) {
      return new Response("Failed to fetch image from upstream host", {
        status: imageRes.status,
      });
    }

    const contentLength = imageRes.headers.get("Content-Length");
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_BYTES) {
      return new Response("Upstream image exceeds size limit", { status: 502 });
    }

    const contentType = imageRes.headers.get("Content-Type");
    if (!contentType || !contentType.toLowerCase().startsWith("image/")) {
      return new Response("Upstream resource is not an image", { status: 415 });
    }

    // Enforce the size cap on the actual stream bytes regardless of Content-Length.
    let bytesReceived = 0;
    const limiter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytesReceived += chunk.byteLength;
        if (bytesReceived > MAX_IMAGE_BYTES) {
          controller.error(new Error("SizeLimitExceeded"));
        } else {
          controller.enqueue(chunk);
        }
      },
    });

    return new Response(imageRes.body!.pipeThrough(limiter), {
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
