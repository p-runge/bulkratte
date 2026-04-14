import { env } from "@/env";
import { r2Core } from "@/lib/r2";
import { GetObjectCommand, S3ServiceException } from "@aws-sdk/client-s3";
import { extname, join } from "path";
import { NextResponse } from "next/server";

async function fetchKey(key: string) {
  const object = await r2Core.send(
    new GetObjectCommand({ Bucket: env.R2_CORE_BUCKET_NAME, Key: key }),
  );
  if (!object.Body) return null;
  return object;
}

function is404(err: unknown): boolean {
  return (
    err instanceof S3ServiceException && err.$metadata.httpStatusCode === 404
  );
}

/** For card images, derive the English fallback key. Returns null for other paths. */
function englishFallbackKey(key: string): string | null {
  // key shape: core/cards/{cardId}/{lang}.{ext}
  const match = key.match(/^(core\/cards\/[^/]+\/)([^/]+)(\.[^.]+)$/);
  if (!match) return null;
  const [, prefix, lang, ext] = match;
  if (lang === "en") return null; // already English, no fallback
  return `${prefix}en${ext}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const key = `core/${path.join("/")}`;

  try {
    const object = await fetchKey(key);
    if (object) {
      const body = Buffer.from(await object.Body!.transformToByteArray());
      return new Response(body, {
        headers: {
          "Content-Type": object.ContentType ?? "image/webp",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    if (!is404(err)) throw err;

    // Try English fallback for localized card images
    const fallbackKey = englishFallbackKey(key);
    if (fallbackKey) {
      try {
        const fallback = await fetchKey(fallbackKey);
        if (fallback) {
          const body = Buffer.from(await fallback.Body!.transformToByteArray());
          return new Response(body, {
            headers: {
              "Content-Type": fallback.ContentType ?? "image/webp",
              // Shorter cache so we'll retry the real image once it's uploaded
              "Cache-Control": "public, max-age=3600",
            },
          });
        }
      } catch (fallbackErr) {
        if (!is404(fallbackErr)) throw fallbackErr;
      }
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
