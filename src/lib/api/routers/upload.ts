import { createTRPCRouter, protectedProcedure } from "@/lib/api/trpc";
import { env } from "@/env";
import { r2 } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";

export const uploadRouter = createTRPCRouter({
  uploadFile: protectedProcedure
    .input(
      z.object({
        data: z.string(), // base64-encoded file contents
        contentType: z.string(),
        filename: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ext = input.filename.split(".").pop() ?? "jpg";
      const key = `user-card-photos/${ctx.session.user.id}/${crypto.randomUUID()}.${ext}`;

      const buffer = Buffer.from(input.data, "base64");

      await r2.send(
        new PutObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: input.contentType,
        }),
      );

      return { url: `/api/images/${key}` };
    }),
});
