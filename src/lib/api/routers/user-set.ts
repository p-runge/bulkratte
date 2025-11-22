import { z } from "zod";

import { userSetCardsTable, userSetsTable } from "@/lib/db/index";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "../trpc";

// const userId = "a2136270-6628-418e-b9f5-8892ba5c79f2"; // TODO: Replace with actual user ID from session

export const userSetRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), cardIds: z.set(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const userSet = await ctx.db
        .insert(userSetsTable)
        .values({
          name: input.name,
          user_id: ctx.session.user.id,
        })
        .returning({
          id: userSetsTable.id,
        })
        .then((res) => res[0]!);

      const cardValues = Array.from(input.cardIds).map((cardId) => ({
        user_set_id: userSet.id,
        card_id: cardId,
      }));

      await ctx.db.insert(userSetCardsTable).values(cardValues);

      return userSet.id;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const data = await ctx.db
        .select({
          id: userSetsTable.id,
          name: userSetsTable.name,
          userId: userSetsTable.user_id,
        })
        .from(userSetsTable)
        .where(eq(userSetsTable.id, input.id))
        .limit(1)
        .then((res) => res[0] ?? null);

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `User set with id ${input.id} not found`,
        });
      }

      const { userId: userSetUserId, ...userSet } = data;

      if (userSetUserId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to access this user set",
        });
      }

      const userSetCards = await ctx.db
        .select({ cardId: userSetCardsTable.card_id })
        .from(userSetCardsTable)
        .where(eq(userSetCardsTable.user_set_id, input.id));

      return {
        set: userSet,
        cards: userSetCards,
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1),
        cardIds: z.set(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userSet = await ctx.db
        .select({
          id: userSetsTable.id,
          userId: userSetsTable.user_id,
        })
        .from(userSetsTable)
        .where(eq(userSetsTable.id, input.id))
        .then((res) => res[0]);

      if (!userSet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `User set with id ${input.id} not found`,
        });
      }

      if (userSet.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to update this user set",
        });
      }

      await ctx.db
        .update(userSetsTable)
        .set({ name: input.name })
        .where(
          and(
            eq(userSetsTable.id, input.id),
            eq(userSetsTable.user_id, ctx.session.user.id)
          )
        )
        .returning({
          id: userSetsTable.id,
          name: userSetsTable.name,
        })
        .then((res) => res[0]!);

      await ctx.db
        .delete(userSetCardsTable)
        .where(eq(userSetCardsTable.user_set_id, input.id));

      const cardValues = Array.from(input.cardIds).map((cardId) => ({
        user_set_id: input.id,
        card_id: cardId,
      }));

      await ctx.db.insert(userSetCardsTable).values(cardValues);

      return userSet;
    }),

  getList: protectedProcedure.query(async ({ ctx }) => {
    const userSets = await ctx.db
      .select({
        id: userSetsTable.id,
        name: userSetsTable.name,
      })
      .from(userSetsTable)
      .where(eq(userSetsTable.user_id, ctx.session.user.id))
      .orderBy(userSetsTable.created_at);

    return userSets ?? null;
  }),

  // TODO: remove
  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
});
