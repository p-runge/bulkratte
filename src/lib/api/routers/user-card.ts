import {
  cardPricesTable,
  cardsTable,
  localizationsTable,
  setsTable,
  userCardsTable,
  userSetCardsTable,
  userSetsTable,
} from "@/lib/db";
import { conditionEnum, languageEnum, variantEnum } from "@/lib/db/enums";
import { localizeRecords } from "@/lib/db/localization";
import { getLanguageFromLocale } from "@/lib/i18n";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
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
      }),
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
        })
        .returning({
          id: userCardsTable.id,
        })
        .then((res) => res[0]!);

      return userCard;
    }),

  getList: protectedProcedure
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
    .query(async ({ ctx, input }) => {
      // Build WHERE conditions
      const conditions = [eq(userCardsTable.user_id, ctx.session.user.id)];

      if (input?.setId) {
        conditions.push(eq(cardsTable.setId, input.setId));
      }

      const langCode = getLanguageFromLocale(ctx.language);

      if (input?.search) {
        const searchCondition = or(
          ilike(cardsTable.name, `%${input.search}%`),
          ilike(cardsTable.number, `%${input.search}%`),
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
          orderByClause = orderDirection(
            sql`COALESCE(${cardPricesTable.price}, 0)`,
          );
          break;
        case "set-and-number":
        default:
          // Sort by set release date first, then by card number within each set
          orderByClause = [
            orderDirection(setsTable.releaseDate),
            orderDirection(
              sql`COALESCE(CAST(NULLIF(regexp_replace(${cardsTable.number}, '[^0-9]', '', 'g'), '') AS INTEGER), 0)`,
            ),
          ];
          break;
      }

      const userCards = await ctx.db
        .select({
          id: userCardsTable.id,
          cardId: userCardsTable.card_id,
          language: userCardsTable.language,
          variant: userCardsTable.variant,
          condition: userCardsTable.condition,
          notes: userCardsTable.notes,
          card: {
            created_at: userCardsTable.created_at,
            updated_at: userCardsTable.updated_at,
            id: cardsTable.id,
            name: cardsTable.name,
            number: cardsTable.number,
            rarity: cardsTable.rarity,
            imageSmall: cardsTable.imageSmall,
            imageLarge: cardsTable.imageLarge,
            setId: cardsTable.setId,
            price: cardPricesTable.price,
          },
          localizedName: localizationsTable.value,
        })
        .from(userCardsTable)
        .innerJoin(cardsTable, eq(userCardsTable.card_id, cardsTable.id))
        .leftJoin(setsTable, eq(cardsTable.setId, setsTable.id))
        .leftJoin(cardPricesTable, eq(cardsTable.id, cardPricesTable.card_id))
        .leftJoin(
          localizationsTable,
          and(
            eq(localizationsTable.table_name, "cards"),
            eq(localizationsTable.column_name, "name"),
            eq(localizationsTable.record_id, cardsTable.id),
            eq(localizationsTable.language, langCode),
          ),
        )
        .where(
          input?.search
            ? and(
                ...conditions,
                or(
                  ilike(cardsTable.name, `%${input.search}%`),
                  ilike(cardsTable.number, `%${input.search}%`),
                  ilike(localizationsTable.value, `%${input.search}%`),
                ),
              )
            : and(...conditions),
        )
        .orderBy(
          ...(Array.isArray(orderByClause) ? orderByClause : [orderByClause]),
        );

      // Localize card data
      const localizedUserCards = await localizeRecords(
        userCards.map((uc) => uc.card),
        "cards",
        ["name", "imageSmall", "imageLarge"],
        ctx.language,
      );

      // Map localized card data back to user cards
      const result = userCards.map(({ cardId, ...uc }, index) => ({
        ...uc,
        card: localizedUserCards[index]!,
      }));

      // Apply name sorting after localization if needed
      if (sortBy === "name") {
        result.sort((a, b) => {
          const comparison = a.card.name.localeCompare(b.card.name);
          return sortOrder === "desc" ? -comparison : comparison;
        });
      }

      return result;
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
            eq(userCardsTable.user_id, ctx.session.user.id),
          ),
        );

      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        language: z.enum(languageEnum.enumValues).optional(),
        variant: z.enum(variantEnum.enumValues).optional(),
        condition: z.enum(conditionEnum.enumValues).optional(),
        notes: z.string().optional(),
      }),
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
          language: input.language,
          variant: input.variant,
          condition: input.condition,
          notes: input.notes,
        })
        .where(
          and(
            eq(userCardsTable.id, input.id),
            eq(userCardsTable.user_id, ctx.session.user.id),
          ),
        );

      return { success: true };
    }),

  getWantlist: protectedProcedure
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
    .query(async ({ ctx, input }) => {
      // Build WHERE conditions for filtering cards
      const conditions = [];

      if (input?.setId) {
        conditions.push(eq(cardsTable.setId, input.setId));
      }

      const langCode = getLanguageFromLocale(ctx.language);

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
          orderByClause = orderDirection(
            sql`COALESCE(${cardPricesTable.price}, 0)`,
          );
          break;
        case "set-and-number":
        default:
          // Sort by set release date first, then by card number within each set
          orderByClause = [
            orderDirection(setsTable.releaseDate),
            orderDirection(
              sql`COALESCE(CAST(NULLIF(regexp_replace(${cardsTable.number}, '[^0-9]', '', 'g'), '') AS INTEGER), 0)`,
            ),
          ];
          break;
      }

      // Get all card IDs that are in user's sets but don't have a user_card_id
      const missingCardIds = await ctx.db
        .selectDistinct({ cardId: userSetCardsTable.card_id })
        .from(userSetCardsTable)
        .innerJoin(
          userSetsTable,
          eq(userSetCardsTable.user_set_id, userSetsTable.id),
        )
        .where(
          and(
            eq(userSetsTable.user_id, ctx.session.user.id),
            sql`${userSetCardsTable.user_card_id} IS NULL`,
          ),
        )
        .then((res) => res.map((row) => row.cardId));

      // If no missing cards, return empty array
      if (missingCardIds.length === 0) {
        return [];
      }

      // Build WHERE conditions for filtering cards
      const cardConditions = [
        sql`${cardsTable.id} IN (${sql.join(
          missingCardIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      ];

      if (input?.setId) {
        cardConditions.push(eq(cardsTable.setId, input.setId));
      }

      if (input?.rarity && input.rarity !== "all") {
        cardConditions.push(sql`${cardsTable.rarity} = ${input.rarity}`);
      }

      const whereClause =
        cardConditions.length > 0 ? and(...cardConditions) : undefined;

      // Get full card data for missing cards
      const missingCards = await ctx.db
        .select({
          id: cardsTable.id,
          name: cardsTable.name,
          number: cardsTable.number,
          rarity: cardsTable.rarity,
          imageSmall: cardsTable.imageSmall,
          imageLarge: cardsTable.imageLarge,
          setId: cardsTable.setId,
          created_at: cardsTable.created_at,
          updated_at: cardsTable.updated_at,
          price: cardPricesTable.price,
        })
        .from(cardsTable)
        .leftJoin(setsTable, eq(cardsTable.setId, setsTable.id))
        .leftJoin(cardPricesTable, eq(cardsTable.id, cardPricesTable.card_id))
        .leftJoin(
          localizationsTable,
          and(
            eq(localizationsTable.table_name, "cards"),
            eq(localizationsTable.column_name, "name"),
            eq(localizationsTable.record_id, cardsTable.id),
            eq(localizationsTable.language, langCode),
          ),
        )
        .where(
          input?.search
            ? and(
                whereClause!,
                or(
                  ilike(cardsTable.name, `%${input.search}%`),
                  ilike(cardsTable.number, `%${input.search}%`),
                  ilike(localizationsTable.value, `%${input.search}%`),
                ),
              )
            : whereClause,
        )
        .orderBy(
          ...(Array.isArray(orderByClause) ? orderByClause : [orderByClause]),
        );

      // Localize card data
      const localizedCards = await localizeRecords(
        missingCards,
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
});
