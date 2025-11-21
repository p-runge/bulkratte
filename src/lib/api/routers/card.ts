import { cardsTable, db } from "@/lib/db";
import { createTRPCRouter, publicProcedure } from "../trpc";
import z from "zod";
import { eq } from "drizzle-orm";

export const cardRouter = createTRPCRouter({
  getList: publicProcedure
    .input(
      z
        .object({
          setId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const cards = await db
        .select()
        .from(cardsTable)
        .where(input?.setId ? eq(cardsTable.setId, input.setId) : undefined)
        .orderBy(cardsTable.updated_at)
        .limit(input?.setId ? -1 : 100);
      return cards;
    }),
});
