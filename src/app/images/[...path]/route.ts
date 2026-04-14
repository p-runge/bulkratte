import { env } from "@/env";
import { r2Core } from "@/lib/r2";
import { GetObjectCommand, S3ServiceException } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const key = `core/${path.join("/")}`;

  try {
    const object = await r2Core.send(
      new GetObjectCommand({ Bucket: env.R2_CORE_BUCKET_NAME, Key: key }),
    );

    if (!object.Body) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = Buffer.from(await object.Body.transformToByteArray());

    return new Response(body, {
      headers: {
        "Content-Type": object.ContentType ?? "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    if (
      err instanceof S3ServiceException &&
      err.$metadata.httpStatusCode === 404
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw err;
  }
}
