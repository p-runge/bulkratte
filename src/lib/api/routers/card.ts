import { cardPricesTable, cardsTable, db } from "@/lib/db";
import { createTRPCRouter, publicProcedure } from "../trpc";
import z from "zod";
import { eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import pokemonAPI from "@/lib/pokemon-api";

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

      const cardsWithPrices = await Promise.all(
        cards.map(async (card) => {
          const prices = await db
            .select({
              price: cardPricesTable.price,
              updatedAt: cardPricesTable.updated_at,
            })
            .from(cardPricesTable)
            .where(eq(cardPricesTable.card_id, card.id))
            .limit(1);

          const price = prices[0];
          let shouldUpdatePrice = false;
          if (!price) {
            shouldUpdatePrice = true;
            // check if price is older than 24 hours
          } else if (
            Date.now() - new Date(price.updatedAt).getTime() >
            1000 * 60 * 60 * 24
          ) {
            shouldUpdatePrice = true;
          }

          let newPrice = null;
          if (shouldUpdatePrice) {
            try {
              const price = await pokemonAPI.fetchPriceForCard(card.id);
              if (price !== null) {
                // upsert price
                await db
                  .insert(cardPricesTable)
                  .values({
                    card_id: card.id,
                    price: price,
                  })
                  .onConflictDoUpdate({
                    target: cardPricesTable.card_id,
                    set: {
                      price: price,
                      updated_at: new Date().toISOString(),
                    },
                  });
              }
              newPrice = price;
            } catch (e) {
              console.error("Error fetching price for card", card.id, e);
            }
          }

          return {
            price: newPrice ?? price?.price,
            ...card,
          };
        })
      );

      return cardsWithPrices;
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

  getByIds: publicProcedure
    .input(
      z.object({
        cardIds: z.array(z.string()),
      })
    )
    .query(async ({ input }) => {
      if (input.cardIds.length === 0) {
        return [];
      }

      const cards = await db
        .select()
        .from(cardsTable)
        .where(inArray(cardsTable.id, input.cardIds));

      return cards;
    }),
});
