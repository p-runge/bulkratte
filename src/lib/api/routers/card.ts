import { cardPricesTable, cardsTable, db, setsTable } from "@/lib/db";
import { localizeRecord, localizeRecords } from "@/lib/db/localization";
import pokemonAPI from "@/lib/pokemon-api";
import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  like,
  lte,
  or,
  sql,
} from "drizzle-orm";
import z from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const cardRouter = createTRPCRouter({
  getList: publicProcedure
    .input(
      z
        .object({
          setId: z.string().optional(),
          search: z.string().optional(),
          rarity: z.string().optional(),
          releaseDateFrom: z.string().optional(),
          releaseDateTo: z.string().optional(),
          sortBy: z
            .enum(["set-and-number", "name", "rarity", "price"])
            .optional()
            .default("set-and-number"),
          sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      // Build WHERE conditions
      const conditions = [];

      if (input?.setId) {
        conditions.push(eq(cardsTable.setId, input.setId));
      }

      if (input?.search) {
        const searchCondition = or(
          like(cardsTable.name, `%${input.search}%`),
          like(cardsTable.number, `%${input.search}%`),
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }

      if (input?.rarity && input.rarity !== "all") {
        conditions.push(sql`${cardsTable.rarity} = ${input.rarity}`);
      }

      if (input?.releaseDateFrom || input?.releaseDateTo) {
        const dateConditions = [];
        if (input.releaseDateFrom) {
          dateConditions.push(
            gte(setsTable.releaseDate, input.releaseDateFrom),
          );
        }
        if (input.releaseDateTo) {
          dateConditions.push(lte(setsTable.releaseDate, input.releaseDateTo));
        }
        if (dateConditions.length > 0) {
          const dateCondition = and(...dateConditions);
          if (dateCondition) {
            conditions.push(dateCondition);
          }
        }
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // Determine order by clause
      // Note: name sorting will be done after localization
      const sortBy = input?.sortBy ?? "set-and-number";
      const sortOrder = input?.sortOrder ?? "asc";
      let orderByClause;
      const orderDirection = sortOrder === "desc" ? desc : asc;

      switch (sortBy) {
        case "name":
          // Skip SQL sorting for name - will sort after localization
          orderByClause = cardsTable.id;
          break;
        case "rarity":
          orderByClause = orderDirection(cardsTable.rarity);
          break;
        case "price":
          orderByClause = orderDirection(cardPricesTable.price);
          break;
        case "set-and-number":
        default:
          // For card number, we want to sort numerically
          // Handle empty strings by converting to NULL, then default to 0
          orderByClause = orderDirection(
            sql`COALESCE(CAST(NULLIF(regexp_replace(${cardsTable.number}, '[^0-9]', '', 'g'), '') AS INTEGER), 0)`,
          );
          break;
      }

      // Build the query with joins and conditions
      const query = db
        .select({
          card: cardsTable,
          releaseDate: setsTable.releaseDate,
          price: cardPricesTable.price,
        })
        .from(cardsTable)
        .innerJoin(setsTable, eq(cardsTable.setId, setsTable.id))
        .leftJoin(cardPricesTable, eq(cardsTable.id, cardPricesTable.card_id))
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(input?.setId ? -1 : 100);

      const results = await query;

      // Process results and handle price updates
      const cardsWithPrices = await Promise.all(
        results.map(async ({ card, price: existingPrice }) => {
          let shouldUpdatePrice = false;
          if (!existingPrice) {
            shouldUpdatePrice = true;
          } else {
            // Check if price is older than 24 hours
            const priceRecord = await db
              .select({
                updatedAt: cardPricesTable.updated_at,
              })
              .from(cardPricesTable)
              .where(eq(cardPricesTable.card_id, card.id))
              .limit(1)
              .then((rows) => rows[0]);

            if (
              priceRecord &&
              Date.now() - new Date(priceRecord.updatedAt).getTime() >
                1000 * 60 * 60 * 24
            ) {
              shouldUpdatePrice = true;
            }
          }

          let newPrice = null;
          if (shouldUpdatePrice) {
            try {
              const fetchedPrice = await pokemonAPI.fetchPriceForCard(card.id);
              if (fetchedPrice !== null) {
                // upsert price
                await db
                  .insert(cardPricesTable)
                  .values({
                    card_id: card.id,
                    price: fetchedPrice,
                  })
                  .onConflictDoUpdate({
                    target: cardPricesTable.card_id,
                    set: {
                      price: fetchedPrice,
                      updated_at: new Date().toISOString(),
                    },
                  });
              }
              newPrice = fetchedPrice;
            } catch (e) {
              console.error("Error fetching price for card", card.id, e);
            }
          }

          return {
            ...card,
            price: newPrice ?? existingPrice ?? undefined,
          };
        }),
      );

      // Localize the cards
      const localizedCards = await localizeRecords(
        cardsWithPrices,
        "cards",
        ["name", "imageSmall", "imageLarge"],
        ctx.language,
      );

      // Apply name sorting after localization if needed
      if (sortBy === "name") {
        localizedCards.sort((a, b) => {
          const comparison = a.name.localeCompare(b.name);
          return sortOrder === "desc" ? -comparison : comparison;
        });
      }

      return localizedCards;
    }),

  getById: publicProcedure
    .input(
      z.object({
        cardId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
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

      return localizeRecord(
        card,
        "cards",
        ["name", "imageSmall", "imageLarge"],
        ctx.language,
      );
    }),

  getByIds: publicProcedure
    .input(
      z.object({
        cardIds: z.array(z.string()),
      }),
    )
    .query(async ({ input, ctx }) => {
      if (input.cardIds.length === 0) {
        return [];
      }

      const cards = await db
        .select()
        .from(cardsTable)
        .where(inArray(cardsTable.id, input.cardIds));

      return localizeRecords(
        cards,
        "cards",
        ["name", "imageSmall", "imageLarge"],
        ctx.language,
      );
    }),
});
