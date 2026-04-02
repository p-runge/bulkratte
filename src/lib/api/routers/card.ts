import {
  cardPricesTable,
  cardsTable,
  db,
  localizationsTable,
  setsTable,
} from "@/lib/db";
import type { Rarity } from "@/lib/db/enums";
import { localizeRecord, localizeRecords } from "@/lib/db/localization";
import { getLanguageFromLocale } from "@/lib/i18n";
import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import z from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

import { cardFilterOptionsSchema, cardsByIdsSchema } from "./card.schemas";

export { cardFilterOptionsSchema, cardsByIdsSchema };

export const cardRouter = createTRPCRouter({
  getList: publicProcedure
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
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      // Build WHERE conditions
      const conditions = [];

      if (input?.setIds?.length) {
        conditions.push(inArray(cardsTable.setId, input.setIds));
      }

      const langCode = getLanguageFromLocale(ctx.language);

      if (input?.rarities?.length) {
        conditions.push(inArray(cardsTable.rarity, input.rarities as Rarity[]));
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
            : conditions.length > 0
              ? and(...conditions)
              : undefined,
        )
        .orderBy(...orderByClauses)
        .limit(input?.setIds?.length === 1 ? -1 : 100);

      const results = await query;

      const cardsWithPrices = results.map(({ card, price: existingPrice }) => ({
        ...card,
        price: existingPrice ?? undefined,
      }));

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

  getFilterOptions: publicProcedure
    .input(
      z
        .object({
          setId: z.string().optional(),
        })
        .optional(),
    )
    .output(cardFilterOptionsSchema)
    .query(async ({ input }) => {
      // Build WHERE conditions
      const conditions = [];

      if (input?.setId) {
        conditions.push(eq(cardsTable.setId, input.setId));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // Query for distinct setIds and rarities
      const results = await db
        .selectDistinct({
          setId: cardsTable.setId,
          rarity: cardsTable.rarity,
        })
        .from(cardsTable)
        .where(whereClause);

      // Extract unique values
      const setIds = [...new Set(results.map((r) => r.setId))];
      const rarities = [
        ...new Set(results.map((r) => r.rarity).filter((r) => r !== null)),
      ];

      return {
        setIds,
        rarities: rarities as string[],
      };
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
    .output(cardsByIdsSchema)
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

  findByOcr: publicProcedure
    .input(
      z.object({
        /** When provided (from symbol matching), used as the primary set filter.
         *  This replaces fuzzy name / total matching entirely. */
        setId: z.string().optional(),
        number: z.string().optional(),
        setTotal: z.number().int().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const conditions = [];

      if (input.setId) {
        // Exact set match from symbol recognition — most precise signal.
        conditions.push(eq(cardsTable.setId, input.setId));
      } else {
        // Fallback: set total when symbol matching didn't find a set.
        if (input.setTotal !== undefined) {
          conditions.push(eq(setsTable.total, input.setTotal));
        }
      }

      // Card number always narrows the results regardless of how we identified the set.
      if (input.number) {
        const normalized = input.number.replace(/^0+/, "") || "0";
        conditions.push(
          or(
            ilike(cardsTable.number, input.number.trim()),
            sql`CAST(NULLIF(regexp_replace(${cardsTable.number}, '^0+', ''), '') AS TEXT) = ${normalized}`,
          ),
        );
      }

      if (conditions.length === 0) return [];

      const results = await db
        .select({ card: cardsTable, set: setsTable })
        .from(cardsTable)
        .innerJoin(setsTable, eq(cardsTable.setId, setsTable.id))
        .where(and(...conditions))
        .limit(10);

      const cards = results.map(({ card, set }) => ({ ...card, set }));

      // Always use English for scanner lookups. The card number and set total
      // are language-neutral, and all scan position analysis was done on
      // English card images. Returning English ensures the displayed image
      // matches what the scanner was calibrated against.
      return localizeRecords(
        cards,
        "cards",
        ["name", "imageSmall", "imageLarge"],
        "en-US",
      );
    }),

  /**
   * Returns 10 random sample cards for the scan tester.
   * When groupId is provided, only cards from the matching era series are returned.
   */
  getScanSamples: publicProcedure
    .input(
      z
        .enum([
          "all",
          "sv",
          "swsh",
          "sun-moon",
          "xy",
          "bw",
          "hgss",
          "platinum",
          "dp",
          "ex-era",
          "base",
          "gym",
          "neo",
          "ecard",
        ])
        .optional(),
    )
    .query(async ({ input }) => {
      const SERIES_FOR_GROUP: Record<string, string[]> = {
        sv: ["Scarlet & Violet"],
        swsh: ["Sword & Shield"],
        "sun-moon": ["Sun & Moon"],
        xy: ["XY", "Mega Evolution"],
        bw: ["Black & White", "McDonald's Collection"],
        hgss: ["HeartGold & SoulSilver", "Call of Legends"],
        platinum: ["Platinum"],
        dp: ["Diamond & Pearl", "POP"],
        "ex-era": ["EX"],
        base: ["Base", "Legendary Collection"],
        gym: ["Gym"],
        neo: ["Neo"],
        ecard: ["E-Card"],
      };

      const seriesList =
        input && input !== "all" ? SERIES_FOR_GROUP[input] : null;

      const conditions = [isNotNull(cardsTable.imageLarge)];
      if (seriesList) conditions.push(inArray(setsTable.series, seriesList));

      return db
        .select({
          id: cardsTable.id,
          name: cardsTable.name,
          number: cardsTable.number,
          imageLarge: cardsTable.imageLarge,
          setName: setsTable.name,
          setTotal: setsTable.total,
          setSeries: setsTable.series,
        })
        .from(cardsTable)
        .innerJoin(setsTable, eq(cardsTable.setId, setsTable.id))
        .where(and(...conditions))
        .orderBy(sql`RANDOM()`)
        .limit(10);
    }),
});
