import { desc, eq, not } from "drizzle-orm";
import { db, setsTable } from "@/lib/db";
import { createTRPCRouter, publicProcedure } from "../trpc";

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
});
