import { usersTable, userSetsTable, wantlistShareLinksTable } from "@/lib/db";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { getWantlistForUser } from "./user-card";

export const wantlistShareLinkRouter = createTRPCRouter({
  /**
   * List all share links owned by the current user, including the names of
   * any scoped user-sets so the UI can display them.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const links = await ctx.db
      .select()
      .from(wantlistShareLinksTable)
      .where(eq(wantlistShareLinksTable.user_id, ctx.session.user.id))
      .orderBy(desc(wantlistShareLinksTable.created_at));

    // Resolve user-set names for scoped links
    const allUserSets = await ctx.db
      .select({ id: userSetsTable.id, name: userSetsTable.name })
      .from(userSetsTable)
      .where(eq(userSetsTable.user_id, ctx.session.user.id));

    const userSetMap = new Map(allUserSets.map((s) => [s.id, s.name]));

    return links.map((link) => ({
      ...link,
      setNames: link.set_ids
        ? link.set_ids.map((id) => userSetMap.get(id) ?? id)
        : null,
    }));
  }),

  /**
   * Create a new share link. If `isSnapshot` is true the current wantlist is
   * computed immediately and frozen into `snapshot_data`.
   */
  create: protectedProcedure
    .input(
      z.object({
        label: z.string().max(128).optional(),
        userSetIds: z.array(z.string().uuid()).optional(),
        isSnapshot: z.boolean().default(false),
        expiresAt: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let snapshotData: unknown = null;

      if (input.isSnapshot) {
        snapshotData = await getWantlistForUser(
          ctx.session.user.id,
          {},
          ctx.language,
          ctx.db,
          { userSetIds: input.userSetIds },
        );
      }

      const [link] = await ctx.db
        .insert(wantlistShareLinksTable)
        .values({
          user_id: ctx.session.user.id,
          label: input.label ?? null,
          set_ids:
            input.userSetIds && input.userSetIds.length > 0
              ? input.userSetIds
              : null,
          is_snapshot: input.isSnapshot,
          snapshot_data: snapshotData,
          expires_at: input.expiresAt ?? null,
        })
        .returning();

      return link;
    }),

  /**
   * Permanently delete (revoke) a share link owned by the current user.
   */
  revoke: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db
        .delete(wantlistShareLinksTable)
        .where(
          and(
            eq(wantlistShareLinksTable.id, input.id),
            eq(wantlistShareLinksTable.user_id, ctx.session.user.id),
          ),
        )
        .returning({ id: wantlistShareLinksTable.id });

      if (!deleted.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Share link not found",
        });
      }

      return { success: true };
    }),

  /**
   * Resolve the metadata for a share link (owner info, label, expiry, scope).
   * Called by the /share/[token] page on first load to render the header.
   * Also bumps last_accessed_at.
   */
  getMetadata: publicProcedure
    .input(z.object({ token: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db
        .select({
          id: wantlistShareLinksTable.id,
          label: wantlistShareLinksTable.label,
          set_ids: wantlistShareLinksTable.set_ids,
          is_snapshot: wantlistShareLinksTable.is_snapshot,
          expires_at: wantlistShareLinksTable.expires_at,
          last_accessed_at: wantlistShareLinksTable.last_accessed_at,
          created_at: wantlistShareLinksTable.created_at,
          ownerName: usersTable.name,
          ownerImage: usersTable.image,
          userId: wantlistShareLinksTable.user_id,
        })
        .from(wantlistShareLinksTable)
        .leftJoin(
          usersTable,
          eq(wantlistShareLinksTable.user_id, usersTable.id),
        )
        .where(eq(wantlistShareLinksTable.id, input.token))
        .then((res) => res[0]);

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Share link not found",
        });
      }

      if (row.expires_at && new Date(row.expires_at) < new Date()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This share link has expired",
        });
      }

      // Resolve set names if scoped
      const setNames: string[] | null = row.set_ids
        ? await ctx.db
            .select({ id: userSetsTable.id, name: userSetsTable.name })
            .from(userSetsTable)
            .then((rows) => {
              const map = new Map(rows.map((s) => [s.id, s.name]));
              return row.set_ids!.map((id) => map.get(id) ?? id);
            })
        : null;

      // Bump last_accessed_at (fire-and-forget, don't await in query)
      void ctx.db
        .update(wantlistShareLinksTable)
        .set({ last_accessed_at: new Date().toISOString() })
        .where(eq(wantlistShareLinksTable.id, input.token));

      return { ...row, setNames };
    }),
});
