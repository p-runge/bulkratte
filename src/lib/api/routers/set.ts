import { desc, eq, isNotNull, not, and } from "drizzle-orm";
import { db, setsTable } from "@/lib/db";
import { localizeRecords, localizeRecord } from "@/lib/db/localization";
import { createTRPCRouter, publicProcedure } from "../trpc";
import z from "zod";

export const setRouter = createTRPCRouter({
  getList: publicProcedure.query(async ({ ctx }) => {
    const sets = await db
      .select()
      .from(setsTable)
      .where(
        not(
          // Only include physical TCG sets
          eq(setsTable.series, "Pokémon TCG Pocket"),
        ),
      )
      .orderBy(desc(setsTable.releaseDate));

    return localizeRecords(sets, "sets", ["name", "series"], ctx.language);
  }),

  /**
   * Lightweight symbol index used by the scan tool.
   * Returns the set ID, symbol URL, and official total for every set that has
   * a symbol image.  The client downloads each symbol, computes a perceptual
   * hash (dHash), and uses Hamming distance to identify a scanned card's set.
   */
  getSymbolIndex: publicProcedure.query(async () => {
    return db
      .select({
        id: setsTable.id,
        symbol: setsTable.symbol,
        total: setsTable.total,
      })
      .from(setsTable)
      .where(
        and(
          isNotNull(setsTable.symbol),
          not(eq(setsTable.series, "Pokémon TCG Pocket")),
        ),
      );
  }),

  getById: publicProcedure.input(z.string()).query(async ({ input, ctx }) => {
    const set = await db
      .select()
      .from(setsTable)
      .where(eq(setsTable.id, input))
      .limit(1)
      .then((res) => res[0]);

    if (!set) return null;

    return localizeRecord(set, "sets", ["name", "series"], ctx.language);
  }),
});
