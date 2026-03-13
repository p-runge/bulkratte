import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "@/env";

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

/** Extract the R2 key from a stored proxy URL like `/api/images/user-card-photos/...` */
export function r2KeyFromUrl(url: string): string {
  return url.replace(/^\/api\/images\//, "");
}

/** Delete one or more objects from R2 by their proxy URLs. Silently ignores errors. */
export async function deleteR2Objects(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  const objects = urls.map((url) => ({ Key: r2KeyFromUrl(url) }));
  await r2
    .send(
      new DeleteObjectsCommand({
        Bucket: env.R2_BUCKET_NAME,
        Delete: { Objects: objects, Quiet: true },
      }),
    )
    .catch((err) => console.error("R2 delete error:", err));
}
