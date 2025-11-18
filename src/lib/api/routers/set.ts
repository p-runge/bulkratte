import { desc, eq, not } from "drizzle-orm";
import { db, setsTable } from "@/lib/db";
import { createTRPCRouter, publicProcedure } from "../trpc";
import z from "zod";

export const setRouter = createTRPCRouter({
  getList: publicProcedure.query(async () => {
    const sets = await db
      .select()
      .from(setsTable)
      .where(
        not(
          // Only include physical TCG sets
          eq(setsTable.series, "Pokémon TCG Pocket")
        )
      )
      .orderBy(desc(setsTable.releaseDate));
    return sets;
  }),

  getById: publicProcedure.input(z.string()).query(async ({ input }) => {
    const set = await db
      .select()
      .from(setsTable)
      .where(eq(setsTable.id, input))
      .limit(1)
      .then((res) => res[0]);
    return set;
  }),
});
