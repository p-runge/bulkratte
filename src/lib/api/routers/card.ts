import { cardsTable, db } from "@/lib/db";
import { createTRPCRouter, publicProcedure } from "../trpc";
import z from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

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

  getById: publicProcedure
    .input(
      z.object({
        cardId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const card = await db
        .select()
        .from(cardsTable)
        .where(eq(cardsTable.id, input.cardId))
        .limit(1)
        .then((rows) => rows[0] || null);

      if (!card) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Card with ID ${input.cardId} not found`,
        });
      }

      return card;
    }),
});
