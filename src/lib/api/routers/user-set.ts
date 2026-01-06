import { z } from "zod";

import { cardsTable, userSetCardsTable, userSetsTable } from "@/lib/db/index";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "../trpc";

// const userId = "a2136270-6628-418e-b9f5-8892ba5c79f2"; // TODO: Replace with actual user ID from session

export const userSetRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        cardIds: z.set(z.string()),
        image: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userSet = await ctx.db
        .insert(userSetsTable)
        .values({
          name: input.name,
          image: input.image ?? null,
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
          image: userSetsTable.image,
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
        .select({
          id: userSetCardsTable.id,
          cardId: userSetCardsTable.card_id,
          userCardId: userSetCardsTable.user_card_id,
          card: {
            id: cardsTable.id,
            name: cardsTable.name,
            number: cardsTable.number,
            rarity: cardsTable.rarity,
            imageSmall: cardsTable.imageSmall,
            imageLarge: cardsTable.imageLarge,
            setId: cardsTable.setId,
          },
        })
        .from(userSetCardsTable)
        .leftJoin(cardsTable, eq(userSetCardsTable.card_id, cardsTable.id))
        .where(eq(userSetCardsTable.user_set_id, input.id))
        .orderBy(asc(userSetCardsTable.created_at), asc(userSetCardsTable.id));

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
        image: z.string().optional(),
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
        .set({ name: input.name, image: input.image ?? null })
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

      // Get existing cards in this set
      const existingCards = await ctx.db
        .select({ cardId: userSetCardsTable.card_id })
        .from(userSetCardsTable)
        .where(eq(userSetCardsTable.user_set_id, input.id));

      const existingCardIds = new Set(existingCards.map((c) => c.cardId));
      const newCardIds = input.cardIds;

      // Find cards to add (in newCardIds but not in existingCardIds)
      const cardsToAdd = Array.from(newCardIds).filter(
        (id) => !existingCardIds.has(id)
      );

      // Find cards to remove (in existingCardIds but not in newCardIds)
      const cardsToRemove = Array.from(existingCardIds).filter(
        (id) => !newCardIds.has(id)
      );

      // Remove cards that are no longer in the set
      if (cardsToRemove.length > 0) {
        await ctx.db
          .delete(userSetCardsTable)
          .where(
            and(
              eq(userSetCardsTable.user_set_id, input.id),
              inArray(userSetCardsTable.card_id, cardsToRemove)
            )
          );
      }

      // Add new cards
      if (cardsToAdd.length > 0) {
        const cardValues = cardsToAdd.map((cardId) => ({
          user_set_id: input.id,
          card_id: cardId,
        }));

        await ctx.db.insert(userSetCardsTable).values(cardValues);
      }

      return userSet;
    }),

  placeCard: protectedProcedure
    .input(
      z.object({
        userSetCardId: z.string().uuid(),
        userCardId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the user_set_card belongs to a set owned by this user
      const userSetCard = await ctx.db
        .select({
          userSetId: userSetCardsTable.user_set_id,
        })
        .from(userSetCardsTable)
        .where(eq(userSetCardsTable.id, input.userSetCardId))
        .then((res) => res[0]);

      if (!userSetCard) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User set card not found",
        });
      }

      const userSet = await ctx.db
        .select({ userId: userSetsTable.user_id })
        .from(userSetsTable)
        .where(eq(userSetsTable.id, userSetCard.userSetId))
        .then((res) => res[0]);

      if (!userSet || userSet.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to modify this user set",
        });
      }

      // Check if this user card is already placed in another user set
      const existingPlacement = await ctx.db
        .select({
          userSetId: userSetCardsTable.user_set_id,
          setName: userSetsTable.name,
        })
        .from(userSetCardsTable)
        .leftJoin(
          userSetsTable,
          eq(userSetCardsTable.user_set_id, userSetsTable.id)
        )
        .where(
          and(
            eq(userSetCardsTable.user_card_id, input.userCardId),
            ne(userSetCardsTable.user_set_id, userSetCard.userSetId)
          )
        )
        .limit(1)
        .then((res) => res[0]);

      if (existingPlacement) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This card is already placed in "${existingPlacement.setName}". Please unplace it from that set first.`,
        });
      }

      // Update the user_card_id
      await ctx.db
        .update(userSetCardsTable)
        .set({ user_card_id: input.userCardId })
        .where(eq(userSetCardsTable.id, input.userSetCardId));

      return { success: true };
    }),

  unplaceCard: protectedProcedure
    .input(
      z.object({
        userSetCardId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the user_set_card belongs to a set owned by this user
      const userSetCard = await ctx.db
        .select({
          userSetId: userSetCardsTable.user_set_id,
        })
        .from(userSetCardsTable)
        .where(eq(userSetCardsTable.id, input.userSetCardId))
        .then((res) => res[0]);

      if (!userSetCard) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User set card not found",
        });
      }

      const userSet = await ctx.db
        .select({ userId: userSetsTable.user_id })
        .from(userSetsTable)
        .where(eq(userSetsTable.id, userSetCard.userSetId))
        .then((res) => res[0]);

      if (!userSet || userSet.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to modify this user set",
        });
      }

      // Set user_card_id to null
      await ctx.db
        .update(userSetCardsTable)
        .set({ user_card_id: null })
        .where(eq(userSetCardsTable.id, input.userSetCardId));

      return { success: true };
    }),

  getList: protectedProcedure.query(async ({ ctx }) => {
    const userSets = await ctx.db
      .select({
        id: userSetsTable.id,
        name: userSetsTable.name,
        image: userSetsTable.image,
      })
      .from(userSetsTable)
      .where(eq(userSetsTable.user_id, ctx.session.user.id))
      .orderBy(userSetsTable.created_at);

    return userSets ?? null;
  }),

  getPlacedUserCardIds: protectedProcedure.query(async ({ ctx }) => {
    // Get all user_card_ids that are currently placed in any user set
    const placedCards = await ctx.db
      .select({
        userCardId: userSetCardsTable.user_card_id,
        userSetId: userSetCardsTable.user_set_id,
        setName: userSetsTable.name,
      })
      .from(userSetCardsTable)
      .leftJoin(
        userSetsTable,
        eq(userSetCardsTable.user_set_id, userSetsTable.id)
      )
      .where(
        and(
          eq(userSetsTable.user_id, ctx.session.user.id),
          isNotNull(userSetCardsTable.user_card_id)
        )
      );

    return placedCards;
  }),

  deleteById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
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
          message: "You do not have permission to delete this user set",
        });
      }

      // Delete all cards associated with this user set
      await ctx.db
        .delete(userSetCardsTable)
        .where(eq(userSetCardsTable.user_set_id, input.id));

      // Delete the user set
      await ctx.db
        .delete(userSetsTable)
        .where(
          and(
            eq(userSetsTable.id, input.id),
            eq(userSetsTable.user_id, ctx.session.user.id)
          )
        );

      return { success: true };
    }),

  // TODO: remove
  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
});
