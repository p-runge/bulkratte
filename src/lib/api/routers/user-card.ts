import {
  cardPricesTable,
  cardsTable,
  db as database,
  localizationsTable,
  setsTable,
  userCardsTable,
  userSetCardsTable,
  userSetsTable,
  wantlistShareLinksTable,
} from "@/lib/db";
import { conditionEnum, languageEnum, variantEnum } from "@/lib/db/enums";
import { localizeRecords } from "@/lib/db/localization";
import { getLanguageFromLocale, Locale } from "@/lib/i18n";
import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

type WantlistFilters = {
  setId?: string;
  search?: string;
  rarity?: string;
  releaseDateFrom?: string;
  releaseDateTo?: string;
  sortBy?: "set-and-number" | "name" | "rarity" | "price";
  sortOrder?: "asc" | "desc";
};

export async function getWantlistForUser(
  userId: string,
  filters: WantlistFilters,
  locale: Locale,
  db: typeof database,
  options?: { userSetIds?: string[] },
) {
  // Build WHERE conditions for filtering cards
  const conditions = [];

  if (filters.setId) {
    conditions.push(eq(cardsTable.setId, filters.setId));
  }

  const langCode = getLanguageFromLocale(locale);

  if (filters.rarity && filters.rarity !== "all") {
    conditions.push(sql`${cardsTable.rarity} = ${filters.rarity}`);
  }

  if (filters.releaseDateFrom || filters.releaseDateTo) {
    const dateConditions = [];
    if (filters.releaseDateFrom) {
      dateConditions.push(gte(setsTable.releaseDate, filters.releaseDateFrom));
    }
    if (filters.releaseDateTo) {
      dateConditions.push(lte(setsTable.releaseDate, filters.releaseDateTo));
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
  const sortBy = filters.sortBy ?? "set-and-number";
  const sortOrder = filters.sortOrder ?? "asc";
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
  // Also get the preferred properties from the user set
  const missingCardsWithPrefs = await db
    .selectDistinct({
      cardId: userSetCardsTable.card_id,
      preferredLanguage: userSetsTable.preferred_language,
      preferredVariant: userSetsTable.preferred_variant,
      preferredCondition: userSetsTable.preferred_condition,
    })
    .from(userSetCardsTable)
    .innerJoin(
      userSetsTable,
      eq(userSetCardsTable.user_set_id, userSetsTable.id),
    )
    .where(
      and(
        eq(userSetsTable.user_id, userId),
        sql`${userSetCardsTable.user_card_id} IS NULL`,
        options?.userSetIds?.length
          ? inArray(userSetsTable.id, options.userSetIds)
          : undefined,
      ),
    );

  const missingCardIds = missingCardsWithPrefs.map((row) => row.cardId);

  // If no missing cards, return empty array
  if (missingCardIds.length === 0) {
    return [];
  }

  // Get card IDs that are already in the user's collection
  const userCardIds = await db
    .select({ cardId: userCardsTable.card_id })
    .from(userCardsTable)
    .where(eq(userCardsTable.user_id, userId))
    .then((res) => res.map((row) => row.cardId));

  // Filter out cards that are already in the user's collection
  const wantlistCardIds = missingCardIds.filter(
    (cardId) => !userCardIds.includes(cardId),
  );

  // If all missing cards are already in collection, return empty array
  if (wantlistCardIds.length === 0) {
    return [];
  }

  // Build WHERE conditions for filtering cards
  const cardConditions = [
    sql`${cardsTable.id} IN (${sql.join(
      wantlistCardIds.map((id) => sql`${id}`),
      sql`, `,
    )})`,
  ];

  if (filters.setId) {
    cardConditions.push(eq(cardsTable.setId, filters.setId));
  }

  if (filters.rarity && filters.rarity !== "all") {
    cardConditions.push(sql`${cardsTable.rarity} = ${filters.rarity}`);
  }

  const whereClause =
    cardConditions.length > 0 ? and(...cardConditions) : undefined;

  // Get full card data for wantlist cards
  const wantlistCards = (
    await db
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
        localizedName: localizationsTable.value,
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
        filters.search
          ? and(
              whereClause!,
              or(
                ilike(cardsTable.name, `%${filters.search}%`),
                ilike(cardsTable.number, `%${filters.search}%`),
                ilike(localizationsTable.value, `%${filters.search}%`),
              ),
            )
          : whereClause,
      )
      .orderBy(
        ...(Array.isArray(orderByClause) ? orderByClause : [orderByClause]),
      )
  ).map((card) => ({
    ...card,
    price: card.price ?? undefined,
  }));

  // Localize card data
  const localizedCards = await localizeRecords(
    wantlistCards,
    "cards",
    ["name", "imageSmall", "imageLarge"],
    locale,
  );

  // Apply name sorting after localization if needed
  if (sortBy === "name") {
    localizedCards.sort((a, b) => {
      const comparison = a.name.localeCompare(b.name);
      return sortOrder === "desc" ? -comparison : comparison;
    });
  }

  // Create UserCard-like objects with preferred properties from user sets
  // For cards that appear in multiple sets, pick the first set's preferences
  const cardPrefsMap = new Map<
    string,
    (typeof missingCardsWithPrefs)[number]
  >();

  for (const row of missingCardsWithPrefs) {
    if (!cardPrefsMap.has(row.cardId)) {
      cardPrefsMap.set(row.cardId, row);
    }
  }

  return localizedCards.map((card) => {
    const prefs = cardPrefsMap.get(card.id);
    return {
      id: `wantlist-${card.id}`, // Virtual ID for the wantlist item
      cardId: card.id,
      language: prefs?.preferredLanguage ?? null,
      variant: prefs?.preferredVariant ?? null,
      condition: prefs?.preferredCondition ?? null,
      notes: null,
      card: {
        created_at: card.created_at,
        updated_at: card.updated_at,
        id: card.id,
        name: card.name,
        number: card.number,
        rarity: card.rarity,
        imageSmall: card.imageSmall,
        imageLarge: card.imageLarge,
        setId: card.setId,
        price: card.price,
      },
      localizedName: card.localizedName,
    };
  }) as any; // Type will be inferred by tRPC based on the actual query result
}

export const userCardRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        cardId: z.string(),
        language: z.enum(languageEnum.enumValues).nullable().optional(),
        variant: z.enum(variantEnum.enumValues).nullable().optional(),
        condition: z.enum(conditionEnum.enumValues).nullable().optional(),
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
          excludeInSets: z.boolean().optional(),
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
      const orderDirection = sortOrder === "desc" ? desc : asc;

      let orderByClauses;

      switch (sortBy) {
        case "name":
          // Skip SQL sorting for name - will sort after localization
          orderByClauses = [cardsTable.id];
          break;
        case "rarity":
          orderByClauses = [orderDirection(cardsTable.rarity)];
          break;
        case "price":
          orderByClauses = [
            orderDirection(sql`COALESCE(${cardPricesTable.price}, 0)`),
          ];
          break;
        case "set-and-number":
        default:
          // Sort by set release date first, then by card number
          // Card number is sorted numerically (extracting digits) then by the full string (for suffixes like "75a", "75b")
          orderByClauses = [
            orderDirection(setsTable.releaseDate),
            orderDirection(
              sql`COALESCE(CAST(NULLIF(regexp_replace(${cardsTable.number}, '[^0-9]', '', 'g'), '') AS INTEGER), 0)`,
            ),
            orderDirection(cardsTable.number),
          ];
          break;
      }

      const userCards = (
        await ctx.db
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
          .orderBy(...orderByClauses)
      ).map((row) => ({
        ...row,
        card: {
          ...row.card,
          price: row.card.price ?? undefined,
        },
      }));

      // Localize card data
      const localizedUserCards = await localizeRecords(
        userCards.map((uc) => uc.card),
        "cards",
        ["name", "imageSmall", "imageLarge"],
        ctx.language,
      );

      // Map localized card data back to user cards
      let result = userCards.map(({ cardId, ...uc }, index) => ({
        ...uc,
        card: localizedUserCards[index]!,
      }));

      // Filter out cards that are in user sets if excludeInSets is true
      if (input?.excludeInSets) {
        const userCardIdsInSets = await ctx.db
          .selectDistinct({ userCardId: userSetCardsTable.user_card_id })
          .from(userSetCardsTable)
          .innerJoin(
            userSetsTable,
            eq(userSetCardsTable.user_set_id, userSetsTable.id),
          )
          .where(
            and(
              eq(userSetsTable.user_id, ctx.session.user.id),
              sql`${userSetCardsTable.user_card_id} IS NOT NULL`,
            ),
          )
          .then((rows) =>
            rows
              .map((row) => row.userCardId)
              .filter((id): id is string => id !== null),
          );

        const userCardIdsInSetsSet = new Set(userCardIdsInSets);
        result = result.filter((uc) => !userCardIdsInSetsSet.has(uc.id));
      }

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

      // First, unplace the card from any user sets by setting user_card_id to null
      await ctx.db
        .update(userSetCardsTable)
        .set({ user_card_id: null })
        .where(eq(userSetCardsTable.user_card_id, input.id));

      // Now delete the user card
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
        language: z.enum(languageEnum.enumValues).nullable().optional(),
        variant: z.enum(variantEnum.enumValues).nullable().optional(),
        condition: z.enum(conditionEnum.enumValues).nullable().optional(),
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
      return getWantlistForUser(
        ctx.session.user.id,
        input ?? {},
        ctx.language,
        ctx.db,
      );
    }),

  getSharedWantlist: publicProcedure
    .input(
      z.object({
        token: z.string().uuid(),
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
      }),
    )
    .query(async ({ ctx, input }) => {
      const { token, ...filters } = input;

      const link = await ctx.db
        .select()
        .from(wantlistShareLinksTable)
        .where(eq(wantlistShareLinksTable.id, token))
        .then((res) => res[0]);

      if (!link) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Share link not found",
        });
      }

      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This share link has expired",
        });
      }

      // For snapshots, return the frozen data directly (no server-side re-filtering)
      if (link.is_snapshot && link.snapshot_data) {
        return link.snapshot_data as Awaited<
          ReturnType<typeof getWantlistForUser>
        >;
      }

      return getWantlistForUser(link.user_id, filters, ctx.language, ctx.db, {
        userSetIds: link.set_ids ?? undefined,
      });
    }),
});
