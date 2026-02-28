import {
  tradeConnectionsTable,
  usersTable,
  wantlistShareLinksTable,
} from "@/lib/db";
import { TRPCError } from "@trpc/server";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

/** Which "side" of a connection the current user is on */
function userSide(
  connection: { requester_id: string; target_id: string | null },
  userId: string,
): "requester" | "target" {
  return connection.requester_id === userId ? "requester" : "target";
}

export const tradeConnectionRouter = createTRPCRouter({
  /**
   * Create a pending trade invite. Returns the invite_token so the UI can
   * construct the invite URL /trade/join/[token].
   */
  createInvite: protectedProcedure.mutation(async ({ ctx }) => {
    const [connection] = await ctx.db
      .insert(tradeConnectionsTable)
      .values({ requester_id: ctx.session.user.id })
      .returning();

    return { inviteToken: connection!.invite_token };
  }),

  /**
   * Public preview of an invite — shows the requester's name + avatar and the
   * current status. Used by the /trade/join/[token] page before the user
   * decides to accept.
   */
  getInvitePreview: publicProcedure
    .input(z.object({ token: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db
        .select({
          id: tradeConnectionsTable.id,
          status: tradeConnectionsTable.status,
          requester_id: tradeConnectionsTable.requester_id,
          target_id: tradeConnectionsTable.target_id,
          requesterName: usersTable.name,
          requesterImage: usersTable.image,
        })
        .from(tradeConnectionsTable)
        .leftJoin(
          usersTable,
          eq(tradeConnectionsTable.requester_id, usersTable.id),
        )
        .where(eq(tradeConnectionsTable.invite_token, input.token))
        .then((res) => res[0]);

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invite not found",
        });
      }

      return row;
    }),

  /**
   * Accept an invite. Creates live share links for both parties and marks the
   * connection as accepted.
   */
  accept: protectedProcedure
    .input(z.object({ token: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.db
        .select()
        .from(tradeConnectionsTable)
        .where(eq(tradeConnectionsTable.invite_token, input.token))
        .then((res) => res[0]);

      if (!connection) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
      }

      if (connection.status === "accepted") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invite has already been accepted",
        });
      }

      if (connection.requester_id === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot accept your own invite",
        });
      }

      // Create a share link from the requester for the target (so target can see requester's wantlist)
      const [requesterLink] = await ctx.db
        .insert(wantlistShareLinksTable)
        .values({
          user_id: connection.requester_id,
          label: `Trade partner: ${ctx.session.user.name ?? "Partner"}`,
          is_snapshot: false,
        })
        .returning();

      // Create a share link from the target (current user) for the requester
      const [targetLink] = await ctx.db
        .insert(wantlistShareLinksTable)
        .values({
          user_id: ctx.session.user.id,
          label: `Trade partner: ${ctx.session.user.name ?? "Partner"}`,
          is_snapshot: false,
        })
        .returning();

      const [updated] = await ctx.db
        .update(tradeConnectionsTable)
        .set({
          status: "accepted",
          target_id: ctx.session.user.id,
          requester_share_link_id: requesterLink!.id,
          target_share_link_id: targetLink!.id,
          updated_at: new Date().toISOString(),
        })
        .where(eq(tradeConnectionsTable.id, connection.id))
        .returning();

      return { connectionId: updated!.id };
    }),

  /**
   * Decline a pending invite.
   */
  decline: protectedProcedure
    .input(z.object({ token: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.db
        .select()
        .from(tradeConnectionsTable)
        .where(eq(tradeConnectionsTable.invite_token, input.token))
        .then((res) => res[0]);

      if (!connection) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
      }

      if (connection.requester_id === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot decline your own invite",
        });
      }

      await ctx.db
        .update(tradeConnectionsTable)
        .set({
          status: "declined",
          target_id: ctx.session.user.id,
          updated_at: new Date().toISOString(),
        })
        .where(eq(tradeConnectionsTable.id, connection.id));

      return { success: true };
    }),

  /**
   * List all trade connections for the current user (accepted + pending
   * outgoing invites). Pending incoming invites (target = me) are also
   * included so the UI can display an accept/decline prompt.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const connections = await ctx.db
      .select({
        id: tradeConnectionsTable.id,
        status: tradeConnectionsTable.status,
        requester_id: tradeConnectionsTable.requester_id,
        target_id: tradeConnectionsTable.target_id,
        invite_token: tradeConnectionsTable.invite_token,
        requester_share_link_id: tradeConnectionsTable.requester_share_link_id,
        target_share_link_id: tradeConnectionsTable.target_share_link_id,
        created_at: tradeConnectionsTable.created_at,
      })
      .from(tradeConnectionsTable)
      .where(
        and(
          or(
            eq(tradeConnectionsTable.requester_id, userId),
            eq(tradeConnectionsTable.target_id, userId),
          ),
          // Exclude declined invites from own view
        ),
      );

    // Fetch partner user info for each connection
    const partnerIds = connections
      .map((c) => (c.requester_id === userId ? c.target_id : c.requester_id))
      .filter((id): id is string => id !== null);

    const partnerUsers =
      partnerIds.length > 0
        ? await ctx.db
            .select({
              id: usersTable.id,
              name: usersTable.name,
              image: usersTable.image,
            })
            .from(usersTable)
            .then((rows) => rows.filter((r) => partnerIds.includes(r.id)))
        : [];

    const partnerMap = new Map(partnerUsers.map((p) => [p.id, p]));

    // Semantics:
    //   requester_share_link_id → requester's wantlist (target can view it)
    //   target_share_link_id    → target's wantlist    (requester can view it)
    return connections.map((c) => {
      const isRequester = c.requester_id === userId;
      const partnerId = isRequester ? c.target_id : c.requester_id;
      const partner = partnerId ? (partnerMap.get(partnerId) ?? null) : null;
      // The share link ID pointing to the PARTNER's wantlist
      const viewPartnerToken = isRequester
        ? c.target_share_link_id
        : c.requester_share_link_id;

      return {
        id: c.id,
        status: c.status,
        isRequester,
        inviteToken: c.invite_token,
        partner,
        viewPartnerToken,
        created_at: c.created_at,
      };
    });
  }),

  /**
   * Get a single accepted connection — used by the /trade/[id] overlap page
   * to retrieve the partner's share link token.
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const connection = await ctx.db
        .select()
        .from(tradeConnectionsTable)
        .where(eq(tradeConnectionsTable.id, input.id))
        .then((res) => res[0]);

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connection not found",
        });
      }

      if (
        connection.requester_id !== userId &&
        connection.target_id !== userId
      ) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      if (connection.status !== "accepted") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Connection is not accepted yet",
        });
      }

      const isRequester = connection.requester_id === userId;
      const partnerId = isRequester
        ? connection.target_id!
        : connection.requester_id;

      const partner = await ctx.db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          image: usersTable.image,
        })
        .from(usersTable)
        .where(eq(usersTable.id, partnerId))
        .then((res) => res[0] ?? null);

      const viewPartnerToken = isRequester
        ? connection.target_share_link_id
        : connection.requester_share_link_id;

      return {
        id: connection.id,
        partner,
        viewPartnerToken,
      };
    }),

  /**
   * Remove a connection and revoke the associated auto-created share links.
   */
  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const connection = await ctx.db
        .select()
        .from(tradeConnectionsTable)
        .where(eq(tradeConnectionsTable.id, input.id))
        .then((res) => res[0]);

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connection not found",
        });
      }

      if (
        connection.requester_id !== userId &&
        connection.target_id !== userId
      ) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Delete the connection row (share links referenced via set null,
      // but we delete them explicitly too)
      await ctx.db
        .delete(tradeConnectionsTable)
        .where(eq(tradeConnectionsTable.id, input.id));

      // Clean up auto-created share links
      const linkIds = [
        connection.requester_share_link_id,
        connection.target_share_link_id,
      ].filter(Boolean) as string[];

      for (const linkId of linkIds) {
        await ctx.db
          .delete(wantlistShareLinksTable)
          .where(eq(wantlistShareLinksTable.id, linkId));
      }

      return { success: true };
    }),
});
