import {
  cardPricesTable,
  cardsTable,
  db as database,
  localizationsTable,
  setsTable,
  userCardPhotosTable,
  userCardsTable,
  userSetCardsTable,
  userSetsTable,
  wantlistShareLinksTable,
} from "@/lib/db";
import {
  conditionEnum,
  languageEnum,
  type Rarity,
  UNSET_FILTER_VALUE,
  variantEnum,
} from "@/lib/db/enums";
import { localizeRecords } from "@/lib/db/localization";
import { getLanguageFromLocale, Locale } from "@/lib/i18n";
import { cardImageUrl } from "@/lib/core-image";
import { deleteR2Objects } from "@/lib/r2";
import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

type WantlistFilters = {
  setIds?: string[];
  search?: string;
  rarities?: string[];
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
  options?: { userSetIds?: string[]; limit?: number },
) {
  // Build WHERE conditions for filtering cards
  const conditions = [];

  if (filters.setIds?.length) {
    conditions.push(inArray(cardsTable.setId, filters.setIds));
  }

  const langCode = getLanguageFromLocale(locale);

  if (filters.rarities?.length) {
    conditions.push(inArray(cardsTable.rarity, filters.rarities as Rarity[]));
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

  const setIdFilter = options?.userSetIds?.length
    ? inArray(userSetsTable.id, options.userSetIds)
    : undefined;

  const prefColumns = {
    cardPreferredLanguage: userSetCardsTable.preferred_language,
    cardPreferredVariant: userSetCardsTable.preferred_variant,
    cardPreferredCondition: userSetCardsTable.preferred_condition,
    setPreferredLanguage: userSetsTable.preferred_language,
    setPreferredVariant: userSetsTable.preferred_variant,
    setPreferredCondition: userSetsTable.preferred_condition,
  };

  // Cards in user's sets that are not yet placed
  const unplacedCardsWithPrefs = await db
    .selectDistinct({ cardId: userSetCardsTable.card_id, ...prefColumns })
    .from(userSetCardsTable)
    .innerJoin(
      userSetsTable,
      eq(userSetCardsTable.user_set_id, userSetsTable.id),
    )
    .where(
      and(
        eq(userSetsTable.user_id, userId),
        isNull(userSetCardsTable.user_card_id),
        setIdFilter,
      ),
    );

  // Cards in user's sets that ARE placed — fetch with placed card's actual attributes
  // to detect when the placed card doesn't satisfy the effective preference
  const placedCardsWithPrefs = await db
    .selectDistinct({
      cardId: userSetCardsTable.card_id,
      ...prefColumns,
      placedLanguage: userCardsTable.language,
      placedVariant: userCardsTable.variant,
      placedCondition: userCardsTable.condition,
    })
    .from(userSetCardsTable)
    .innerJoin(
      userSetsTable,
      eq(userSetCardsTable.user_set_id, userSetsTable.id),
    )
    .innerJoin(
      userCardsTable,
      eq(userSetCardsTable.user_card_id, userCardsTable.id),
    )
    .where(
      and(
        eq(userSetsTable.user_id, userId),
        sql`${userSetCardsTable.user_card_id} IS NOT NULL`,
        setIdFilter,
      ),
    );

  // A placed card still belongs on the wantlist if its actual attributes don't
  // satisfy the effective preference (card-level overrides set-level)
  const mismatchedPlacedCards = placedCardsWithPrefs.filter((row) => {
    const effectiveLanguage =
      row.cardPreferredLanguage ?? row.setPreferredLanguage;
    const effectiveVariant =
      row.cardPreferredVariant ?? row.setPreferredVariant;
    const effectiveCondition =
      row.cardPreferredCondition ?? row.setPreferredCondition;
    return (
      (effectiveLanguage !== null &&
        row.placedLanguage !== effectiveLanguage) ||
      (effectiveVariant !== null && row.placedVariant !== effectiveVariant) ||
      (effectiveCondition !== null &&
        row.placedCondition !== effectiveCondition)
    );
  });

  // Merged prefs rows (without placed* columns) used to build the prefs map later
  type PrefsRow = {
    cardId: string;
    cardPreferredLanguage:
      | (typeof prefColumns.cardPreferredLanguage)["_"]["data"]
      | null;
    cardPreferredVariant:
      | (typeof prefColumns.cardPreferredVariant)["_"]["data"]
      | null;
    cardPreferredCondition:
      | (typeof prefColumns.cardPreferredCondition)["_"]["data"]
      | null;
    setPreferredLanguage:
      | (typeof prefColumns.setPreferredLanguage)["_"]["data"]
      | null;
    setPreferredVariant:
      | (typeof prefColumns.setPreferredVariant)["_"]["data"]
      | null;
    setPreferredCondition:
      | (typeof prefColumns.setPreferredCondition)["_"]["data"]
      | null;
  };
  const allCardsWithPrefs: PrefsRow[] = [
    ...unplacedCardsWithPrefs,
    ...mismatchedPlacedCards,
  ];

  // Get card IDs that are already in the user's collection
  const unplacedCardIds = unplacedCardsWithPrefs.map((row) => row.cardId);
  const userCardIds = unplacedCardIds.length
    ? await db
        .select({ cardId: userCardsTable.card_id })
        .from(userCardsTable)
        .where(eq(userCardsTable.user_id, userId))
        .then((res) => res.map((row) => row.cardId))
    : [];

  // Unplaced cards that the user doesn't already own
  const unplacedWantlistIds = unplacedCardIds.filter(
    (cardId) => !userCardIds.includes(cardId),
  );

  // Combine with mismatched placed cards (deduplicated)
  const mismatchedIds = mismatchedPlacedCards.map((row) => row.cardId);
  const wantlistCardIds = [
    ...new Set([...unplacedWantlistIds, ...mismatchedIds]),
  ];

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

  if (filters.setIds?.length) {
    cardConditions.push(inArray(cardsTable.setId, filters.setIds));
  }

  if (filters.rarities?.length) {
    cardConditions.push(
      inArray(cardsTable.rarity, filters.rarities as Rarity[]),
    );
  }

  const whereClause =
    cardConditions.length > 0 ? and(...cardConditions) : undefined;

  // Get full card data for wantlist cards
  const baseQuery = db
    .select({
      id: cardsTable.id,
      name: cardsTable.name,
      number: cardsTable.number,
      rarity: cardsTable.rarity,
      image: cardsTable.image,
      setId: cardsTable.setId,
      setReleaseDate: setsTable.releaseDate,
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
    .$dynamic();

  const rawRows = await (options?.limit !== undefined
    ? baseQuery.limit(options.limit)
    : baseQuery);

  const wantlistCards = rawRows.map((card) => ({
    ...card,
    price: card.price ?? undefined,
  }));

  // Localize card data
  const localizedCards = await localizeRecords(
    wantlistCards,
    "cards",
    ["name", "image"],
    locale,
  );

  // Apply name sorting after localization if needed
  if (sortBy === "name") {
    localizedCards.sort((a, b) => {
      const comparison = a.name.localeCompare(b.name);
      return sortOrder === "desc" ? -comparison : comparison;
    });
  }

  // Create UserCard-like objects with preferred properties from user sets.
  // Card-level preferences override set-level preferences.
  // For cards that appear in multiple sets, prefer the entry that has a card-level override.
  const cardPrefsMap = new Map<string, PrefsRow>();

  for (const row of allCardsWithPrefs) {
    const existing = cardPrefsMap.get(row.cardId);
    if (
      !existing ||
      (!existing.cardPreferredLanguage && row.cardPreferredLanguage)
    ) {
      cardPrefsMap.set(row.cardId, row);
    }
  }

  return localizedCards.map((card) => {
    const prefs = cardPrefsMap.get(card.id);
    const effectiveLang =
      prefs?.cardPreferredLanguage ?? prefs?.setPreferredLanguage ?? null;
    return {
      id: `wantlist-${card.id}`, // Virtual ID for the wantlist item
      cardId: card.id,
      language: prefs
        ? (prefs.cardPreferredLanguage ?? prefs.setPreferredLanguage)
        : null,
      variant: prefs
        ? (prefs.cardPreferredVariant ?? prefs.setPreferredVariant)
        : null,
      condition: prefs
        ? (prefs.cardPreferredCondition ?? prefs.setPreferredCondition)
        : null,
      notes: null as null,
      card: {
        created_at: card.created_at,
        updated_at: card.updated_at,
        id: card.id,
        name: card.name,
        number: card.number,
        rarity: card.rarity,
        image: effectiveLang
          ? cardImageUrl(card.id, effectiveLang)
          : card.image,
        setId: card.setId,
        price: card.price,
        setReleaseDate: card.setReleaseDate,
      },
      localizedName: card.localizedName,
      photos: [] as string[],
      coverPhoto: null,
      coverCrop: null,
    };
  });
}

import {
  userCardListSchema,
  userCardWantlistSchema,
} from "./user-card.schemas";

export { userCardListSchema, userCardWantlistSchema };

const coverCropObjectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const coverCropSchema = coverCropObjectSchema.nullable().optional();

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
        coverPhotoUrl: z.string().optional(),
        coverCrop: coverCropSchema,
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

      if (input.photos && input.photos.length > 0) {
        await ctx.db.insert(userCardPhotosTable).values(
          input.photos.map((url, position) => {
            const isCover = url === input.coverPhotoUrl;
            return {
              user_card_id: userCard.id,
              url,
              position,
              is_cover: isCover,
              crop_x: isCover ? (input.coverCrop?.x ?? null) : null,
              crop_y: isCover ? (input.coverCrop?.y ?? null) : null,
              crop_width: isCover ? (input.coverCrop?.width ?? null) : null,
              crop_height: isCover ? (input.coverCrop?.height ?? null) : null,
            };
          }),
        );
      }

      return userCard;
    }),

  getList: protectedProcedure
    .input(
      z
        .object({
          setIds: z.array(z.string()).optional(),
          search: z.string().optional(),
          rarities: z.array(z.string()).optional(),
          languages: z.array(z.string()).optional(),
          variants: z.array(z.string()).optional(),
          conditions: z.array(z.string()).optional(),
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
    .output(userCardListSchema)
    .query(async ({ ctx, input }) => {
      // Build WHERE conditions
      const conditions = [eq(userCardsTable.user_id, ctx.session.user.id)];

      if (input?.setIds?.length) {
        conditions.push(inArray(cardsTable.setId, input.setIds));
      }

      const langCode = getLanguageFromLocale(ctx.language);

      if (input?.rarities?.length) {
        conditions.push(inArray(cardsTable.rarity, input.rarities as Rarity[]));
      }

      if (input?.languages?.length) {
        const actual = input.languages.filter(
          (l) => l !== UNSET_FILTER_VALUE,
        ) as (typeof languageEnum.enumValues)[number][];
        const includeUnset = input.languages.includes(UNSET_FILTER_VALUE);
        const parts = [
          ...(actual.length ? [inArray(userCardsTable.language, actual)] : []),
          ...(includeUnset ? [isNull(userCardsTable.language)] : []),
        ];
        if (parts.length === 1) conditions.push(parts[0]!);
        else if (parts.length > 1) conditions.push(or(...parts)!);
      }

      if (input?.variants?.length) {
        const actual = input.variants.filter(
          (v) => v !== UNSET_FILTER_VALUE,
        ) as (typeof variantEnum.enumValues)[number][];
        const includeUnset = input.variants.includes(UNSET_FILTER_VALUE);
        const parts = [
          ...(actual.length ? [inArray(userCardsTable.variant, actual)] : []),
          ...(includeUnset ? [isNull(userCardsTable.variant)] : []),
        ];
        if (parts.length === 1) conditions.push(parts[0]!);
        else if (parts.length > 1) conditions.push(or(...parts)!);
      }

      if (input?.conditions?.length) {
        const actual = input.conditions.filter(
          (c) => c !== UNSET_FILTER_VALUE,
        ) as (typeof conditionEnum.enumValues)[number][];
        const includeUnset = input.conditions.includes(UNSET_FILTER_VALUE);
        const parts = [
          ...(actual.length ? [inArray(userCardsTable.condition, actual)] : []),
          ...(includeUnset ? [isNull(userCardsTable.condition)] : []),
        ];
        if (parts.length === 1) conditions.push(parts[0]!);
        else if (parts.length > 1) conditions.push(or(...parts)!);
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
              image: cardsTable.image,
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

      // Fetch photos for all user cards
      const userCardIds = userCards.map((uc) => uc.id);
      const allPhotos =
        userCardIds.length > 0
          ? await ctx.db
              .select({
                user_card_id: userCardPhotosTable.user_card_id,
                url: userCardPhotosTable.url,
                position: userCardPhotosTable.position,
                is_cover: userCardPhotosTable.is_cover,
                crop_x: userCardPhotosTable.crop_x,
                crop_y: userCardPhotosTable.crop_y,
                crop_width: userCardPhotosTable.crop_width,
                crop_height: userCardPhotosTable.crop_height,
              })
              .from(userCardPhotosTable)
              .where(inArray(userCardPhotosTable.user_card_id, userCardIds))
              .orderBy(userCardPhotosTable.position)
          : [];

      const photosByCardId = new Map<
        string,
        {
          urls: string[];
          coverPhotoUrl: string | null;
          coverCrop: {
            x: number;
            y: number;
            width: number;
            height: number;
          } | null;
        }
      >();
      for (const photo of allPhotos) {
        const existing = photosByCardId.get(photo.user_card_id) ?? {
          urls: [],
          coverPhotoUrl: null,
          coverCrop: null,
        };
        existing.urls.push(photo.url);
        if (photo.is_cover) {
          existing.coverPhotoUrl = photo.url;
          if (
            photo.crop_x != null &&
            photo.crop_y != null &&
            photo.crop_width != null &&
            photo.crop_height != null
          ) {
            existing.coverCrop = {
              x: photo.crop_x,
              y: photo.crop_y,
              width: photo.crop_width,
              height: photo.crop_height,
            };
          }
        }
        photosByCardId.set(photo.user_card_id, existing);
      }

      // Localize card data
      const localizedUserCards = await localizeRecords(
        userCards.map((uc) => uc.card),
        "cards",
        ["name", "image"],
        ctx.language,
      );

      // Map localized card data back to user cards
      let result = userCards.map(({ cardId, ...uc }, index) => ({
        ...uc,
        photos: photosByCardId.get(uc.id)?.urls ?? [],
        coverPhoto: photosByCardId.get(uc.id)?.coverPhotoUrl ?? null,
        coverCrop: photosByCardId.get(uc.id)?.coverCrop ?? null,
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

      // Delete photos from R2 before the card (and its photos) are cascade-deleted
      const photos = await ctx.db
        .select({ url: userCardPhotosTable.url })
        .from(userCardPhotosTable)
        .where(eq(userCardPhotosTable.user_card_id, input.id));
      await deleteR2Objects(photos.map((p) => p.url));

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
        photos: z.array(z.string()).optional(),
        coverPhotoUrl: z.string().nullable().optional(),
        coverCrop: coverCropSchema,
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

      if (input.photos !== undefined) {
        // Fetch existing photos and remove them from R2 before replacing
        const existing = await ctx.db
          .select({ url: userCardPhotosTable.url })
          .from(userCardPhotosTable)
          .where(eq(userCardPhotosTable.user_card_id, input.id));
        const removed = existing
          .map((p) => p.url)
          .filter((url) => !input.photos!.includes(url));
        await deleteR2Objects(removed);

        // Replace all photos: delete existing, re-insert in order
        await ctx.db
          .delete(userCardPhotosTable)
          .where(eq(userCardPhotosTable.user_card_id, input.id));

        if (input.photos.length > 0) {
          await ctx.db.insert(userCardPhotosTable).values(
            input.photos.map((url, position) => {
              const isCover = url === input.coverPhotoUrl;
              return {
                user_card_id: input.id,
                url,
                position,
                is_cover: isCover,
                crop_x: isCover ? (input.coverCrop?.x ?? null) : null,
                crop_y: isCover ? (input.coverCrop?.y ?? null) : null,
                crop_width: isCover ? (input.coverCrop?.width ?? null) : null,
                crop_height: isCover ? (input.coverCrop?.height ?? null) : null,
              };
            }),
          );
        }
      }

      return { success: true };
    }),

  getWantlist: protectedProcedure
    .input(
      z
        .object({
          setIds: z.array(z.string()).optional(),
          search: z.string().optional(),
          rarities: z.array(z.string()).optional(),
          releaseDateFrom: z.string().optional(),
          releaseDateTo: z.string().optional(),
          sortBy: z
            .enum(["set-and-number", "name", "rarity", "price"])
            .optional()
            .default("set-and-number"),
          sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
          limit: z.number().int().positive().optional(),
        })
        .optional(),
    )
    .output(userCardWantlistSchema)
    .query(async ({ ctx, input }) => {
      const { limit, ...filters } = input ?? {};
      return getWantlistForUser(
        ctx.session.user.id,
        filters,
        ctx.language,
        ctx.db,
        { limit },
      );
    }),

  getSharedWantlist: publicProcedure
    .input(
      z.object({
        token: z.string().uuid(),
        setIds: z.array(z.string()).optional(),
        search: z.string().optional(),
        rarities: z.array(z.string()).optional(),
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
