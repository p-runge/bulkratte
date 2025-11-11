import {
  conditionEnum,
  languageEnum,
  userCardsTable,
  variantEnum,
} from "@/lib/db/index";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const userCardRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        cardId: z.string(),
        language: z.enum(languageEnum.enumValues),
        variant: z.enum(variantEnum.enumValues),
        condition: z.enum(conditionEnum.enumValues),
        notes: z.string().optional(),
        photos: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userCard = await ctx.db
        .insert(userCardsTable)
        .values({
          user_id: ctx.session.user.id,
          card_id: input.cardId,
          language: input.language,
          variant: input.variant,
          condition: input.condition,
          notes: input.notes,
          photos: input.photos || [],
        })
        .returning({
          id: userCardsTable.id,
        })
        .then((res) => res[0]!);

      return userCard;
    }),

  getList: protectedProcedure.query(async ({ ctx }) => {
    const userCards = await ctx.db
      .select()
      .from(userCardsTable)
      .where(eq(userCardsTable.user_id, ctx.session.user.id))
      .orderBy(userCardsTable.created_at);

    return userCards;
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userCard = await ctx.db
        .select({ userId: userCardsTable.user_id })
        .from(userCardsTable)
        .where(eq(userCardsTable.id, input.id))
        .then((res) => res[0]);

      if (!userCard) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `User card with id ${input.id} not found`,
        });
      }

      if (userCard.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to delete this card",
        });
      }

      await ctx.db
        .delete(userCardsTable)
        .where(
          and(
            eq(userCardsTable.id, input.id),
            eq(userCardsTable.user_id, ctx.session.user.id)
          )
        );

      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        notes: z.string().optional(),
        photos: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userCard = await ctx.db
        .select({ userId: userCardsTable.user_id })
        .from(userCardsTable)
        .where(eq(userCardsTable.id, input.id))
        .then((res) => res[0]);

      if (!userCard) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `User card with id ${input.id} not found`,
        });
      }

      if (userCard.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to update this card",
        });
      }

      await ctx.db
        .update(userCardsTable)
        .set({
          notes: input.notes,
          photos: input.photos,
        })
        .where(
          and(
            eq(userCardsTable.id, input.id),
            eq(userCardsTable.user_id, ctx.session.user.id)
          )
        );

      return { success: true };
    }),
});
