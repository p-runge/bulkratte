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

    // Buffer the stream before responding so we can enforce the size cap and
    // return a proper error status (rather than a 200 that truncates mid-stream).
    const reader = imageRes.body?.getReader();
    if (!reader) {
      return new Response("Upstream image has no readable body", {
        status: 502,
      });
    }
    const chunks: Uint8Array[] = [];
    let bytesReceived = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      bytesReceived += value.byteLength;
      if (bytesReceived > MAX_IMAGE_BYTES) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        return new Response("Upstream image exceeds size limit", {
          status: 502,
        });
      }
      chunks.push(value);
    }
    const body = new Uint8Array(bytesReceived);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return new Response(body, {
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
