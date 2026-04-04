import { type QueryClient } from "@tanstack/react-query";
import { type ZodTypeAny } from "zod";

import {
  cardFilterOptionsSchema,
  cardsByIdsSchema,
} from "@/lib/api/routers/card.schemas";
import {
  placedUserCardIdsSchema,
  userSetByIdSchema,
  userSetListSchema,
} from "@/lib/api/routers/user-set.schemas";
import {
  userCardListSchema,
  userCardWantlistSchema,
} from "@/lib/api/routers/user-card.schemas";

const CACHE_SCHEMAS: Record<string, ZodTypeAny> = {
  "card.getFilterOptions": cardFilterOptionsSchema,
  "card.getByIds": cardsByIdsSchema,
  "userSet.getList": userSetListSchema,
  "userSet.getById": userSetByIdSchema,
  "userSet.getPlacedUserCardIds": placedUserCardIdsSchema,
  "userCard.getList": userCardListSchema,
  "userCard.getWantlist": userCardWantlistSchema,
};

/**
 * Validates all persisted queries restored from localStorage against their Zod
 * schemas. Any entry that fails validation is removed so TanStack Query
 * refetches fresh data instead of crashing on a stale or mismatched shape.
 */
export function validateRestoredCache(queryClient: QueryClient) {
  for (const [path, schema] of Object.entries(CACHE_SCHEMAS)) {
    const keyParts = path.split(".");
    const queries = queryClient.getQueriesData<unknown>({
      queryKey: [keyParts],
    });

    for (const [queryKey, data] of queries) {
      if (data === undefined) continue;

      const result = schema.safeParse(data);
      if (!result.success) {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            `[cache] Stale or structurally invalid cache entry for "${path}" cleared for refetch:`,
            result.error.format(),
          );
        }
        queryClient.removeQueries({ queryKey });
      }
    }
  }
}
