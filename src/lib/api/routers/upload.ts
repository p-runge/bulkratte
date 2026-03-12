import { createTRPCRouter, protectedProcedure } from "@/lib/api/trpc";
import { env } from "@/env";
import { r2 } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

// NOTE: Direct browser → R2 uploads require CORS configured on the R2 bucket:
// AllowedOrigins: [your app origin], AllowedMethods: ["PUT"], AllowedHeaders: ["Content-Type"]

export const uploadRouter = createTRPCRouter({
  createPresignedUploadUrl: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        contentType: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ext = input.filename.split(".").pop() ?? "jpg";
      const key = `user-card-photos/${ctx.session.user.id}/${crypto.randomUUID()}.${ext}`;

      const uploadUrl = await getSignedUrl(
        r2,
        new PutObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: key,
          ContentType: input.contentType,
        }),
        { expiresIn: 300 },
      );

      return { uploadUrl, key };
    }),
});
