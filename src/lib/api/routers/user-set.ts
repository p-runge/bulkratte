import { z } from "zod";

import { conditionEnum, languageEnum, variantEnum } from "@/lib/db/enums";
import { cardsTable, userSetCardsTable, userSetsTable } from "@/lib/db/index";
import { localizeRecords } from "@/lib/db/localization";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const userSetRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        cardData: z.array(
          z.object({
            cardId: z.string(),
            order: z.number(),
          }),
        ),
        image: z.string().optional(),
        preferredLanguage: z.enum(languageEnum.enumValues).nullish(),
        preferredVariant: z.enum(variantEnum.enumValues).nullish(),
        preferredCondition: z.enum(conditionEnum.enumValues).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userSet = await ctx.db
        .insert(userSetsTable)
        .values({
          name: input.name,
          image: input.image,
          user_id: ctx.session.user.id,
          preferred_language: input.preferredLanguage,
          preferred_variant: input.preferredVariant,
          preferred_condition: input.preferredCondition,
        })
        .returning({
          id: userSetsTable.id,
        })
        .then((res) => res[0]!);

      if (input.cardData.length > 0) {
        await ctx.db.insert(userSetCardsTable).values(
          input.cardData.map((card) => ({
            user_set_id: userSet.id,
            card_id: card.cardId,
            order: card.order,
          })),
        );
      }

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
          createdAt: userSetsTable.created_at,
          preferredLanguage: userSetsTable.preferred_language,
          preferredVariant: userSetsTable.preferred_variant,
          preferredCondition: userSetsTable.preferred_condition,
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
          order: userSetCardsTable.order,
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
        .orderBy(asc(userSetCardsTable.order), asc(userSetCardsTable.id));

      // Separate cards that exist from those that don't
      const cardsToLocalize = userSetCards
        .map((usc) => usc.card)
        .filter((c): c is NonNullable<typeof c> => c !== null && c.id !== null);

      // Localize card data
      const localizedCards = await localizeRecords(
        cardsToLocalize,
        "cards",
        ["name", "imageSmall", "imageLarge"],
        ctx.language,
      );

      // Create a map of card id to localized card
      const localizedCardMap = new Map(
        localizedCards.map((card) => [card.id, card]),
      );

      // Map localized card data back to user set cards
      const localizedUserSetCards = userSetCards.map((usc) => {
        if (!usc.card || !usc.card.id) return usc;
        const localizedCard = localizedCardMap.get(usc.card.id);
        return {
          ...usc,
          card: localizedCard ?? usc.card,
        };
      });

      return {
        set: userSet,
        cards: localizedUserSetCards,
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1),
        cards: z.array(
          z.object({
            userSetCardId: z.string().uuid().nullable(), // null for new cards
            cardId: z.string().nullable(),
            order: z.number(),
          }),
        ),
        image: z.string().optional(),
        preferredLanguage: z.enum(languageEnum.enumValues).nullish(),
        preferredVariant: z.enum(variantEnum.enumValues).nullish(),
        preferredCondition: z.enum(conditionEnum.enumValues).nullish(),
      }),
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
        .set({
          name: input.name,
          image: input.image ?? null,
          preferred_language: input.preferredLanguage,
          preferred_variant: input.preferredVariant,
          preferred_condition: input.preferredCondition,
        })
        .where(
          and(
            eq(userSetsTable.id, input.id),
            eq(userSetsTable.user_id, ctx.session.user.id),
          ),
        )
        .returning({
          id: userSetsTable.id,
          name: userSetsTable.name,
        })
        .then((res) => res[0]!);

      // Get all existing cards to find which ones to delete
      const existingCards = await ctx.db
        .select({
          id: userSetCardsTable.id,
        })
        .from(userSetCardsTable)
        .where(eq(userSetCardsTable.user_set_id, input.id));

      const existingIds = new Set(existingCards.map((c) => c.id));
      const inputIds = new Set(
        input.cards
          .map((c) => c.userSetCardId)
          .filter((id): id is string => id !== null),
      );

      // Find cards to delete (exist in DB but not in input)
      const idsToDelete = Array.from(existingIds).filter(
        (id) => !inputIds.has(id),
      );

      if (idsToDelete.length > 0) {
        await ctx.db
          .delete(userSetCardsTable)
          .where(
            and(
              eq(userSetCardsTable.user_set_id, input.id),
              inArray(userSetCardsTable.id, idsToDelete),
            ),
          );
      }

      // Process each card in the input array
      // First, set all existing cards to negative orders to avoid conflicts
      const existingCardsToUpdate = input.cards.filter(
        (card) => card.userSetCardId !== null,
      );

      for (let i = 0; i < existingCardsToUpdate.length; i++) {
        const card = existingCardsToUpdate[i];
        if (card?.userSetCardId) {
          await ctx.db
            .update(userSetCardsTable)
            .set({ order: -(i + 1) }) // Negative to avoid conflicts
            .where(eq(userSetCardsTable.id, card.userSetCardId));
        }
      }

      // Now update with final order and cardId
      for (let i = 0; i < input.cards.length; i++) {
        const card = input.cards[i];
        if (!card || !card.cardId) continue;

        if (card.userSetCardId) {
          // Update existing card's order and cardId
          await ctx.db
            .update(userSetCardsTable)
            .set({
              order: card.order,
              card_id: card.cardId,
            })
            .where(eq(userSetCardsTable.id, card.userSetCardId));
        } else {
          // Insert new card
          await ctx.db.insert(userSetCardsTable).values({
            user_set_id: input.id,
            card_id: card.cardId,
            order: card.order,
          });
        }
      }

      return userSet;
    }),

  placeCard: protectedProcedure
    .input(
      z.object({
        userSetCardId: z.string().uuid(),
        userCardId: z.string().uuid(),
      }),
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
          eq(userSetCardsTable.user_set_id, userSetsTable.id),
        )
        .where(
          and(
            eq(userSetCardsTable.user_card_id, input.userCardId),
            ne(userSetCardsTable.user_set_id, userSetCard.userSetId),
          ),
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
      }),
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
        preferredLanguage: userSetsTable.preferred_language,
        preferredVariant: userSetsTable.preferred_variant,
        preferredCondition: userSetsTable.preferred_condition,
      })
      .from(userSetsTable)
      .where(eq(userSetsTable.user_id, ctx.session.user.id))
      .orderBy(userSetsTable.created_at);

    // Get card counts for each user set
    const userSetsWithCounts = await Promise.all(
      userSets.map(async (userSet) => {
        const cards = await ctx.db
          .select({
            id: userSetCardsTable.id,
            userCardId: userSetCardsTable.user_card_id,
          })
          .from(userSetCardsTable)
          .where(eq(userSetCardsTable.user_set_id, userSet.id));

        const totalCards = cards.length;
        const placedCards = cards.filter(
          (card) => card.userCardId !== null,
        ).length;

        return {
          ...userSet,
          totalCards,
          placedCards,
        };
      }),
    );

    return userSetsWithCounts;
  }),

  getPlacedUserCardIds: protectedProcedure.query(async ({ ctx }) => {
    // Get all user_card_ids that are currently placed in any user set
    const placedCards = await ctx.db
      .select({
        userCardId: userSetCardsTable.user_card_id,
        userSetId: userSetCardsTable.user_set_id,
        userSetCardId: userSetCardsTable.id,
        setName: userSetsTable.name,
      })
      .from(userSetCardsTable)
      .innerJoin(
        userSetsTable,
        eq(userSetCardsTable.user_set_id, userSetsTable.id),
      )
      .where(
        and(
          eq(userSetsTable.user_id, ctx.session.user.id),
          isNotNull(userSetCardsTable.user_card_id),
        ),
      );

    // Type assertion: we know userCardId and setName are non-null due to WHERE clause and innerJoin
    return placedCards as Array<{
      userCardId: string;
      userSetId: string;
      userSetCardId: string;
      setName: string;
    }>;
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
            eq(userSetsTable.user_id, ctx.session.user.id),
          ),
        );

      return { success: true };
    }),

  // TODO: remove
  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
});
