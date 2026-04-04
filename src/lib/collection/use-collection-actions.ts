"use client";

import { api, RouterInputs, RouterOutputs } from "@/lib/api/react";
import { useRef } from "react";
import { useIntl } from "react-intl";
import { toast } from "sonner";

type Card = RouterOutputs["card"]["getById"];

/**
 * Centralizes all collection mutations with consistent optimistic updates.
 *
 * Actions dispatch immediately and update the React Query cache, giving an
 * instant UI response. The background API call then confirms or rolls back.
 *
 * Usage: const { card, set, shareLink } = useCollectionActions();
 */
export function useCollectionActions() {
  const utils = api.useUtils();
  const intl = useIntl();

  // Ref used to pass the card object into the create mutation's onMutate callback.
  const cardForCreateRef = useRef<Card | null>(null);

  // ---------------------------------------------------------------------------
  // userCard mutations
  // ---------------------------------------------------------------------------

  const createCardMutation = api.userCard.create.useMutation({
    onMutate: async (input) => {
      const card = cardForCreateRef.current;
      if (!card) return;
      await utils.userCard.getList.cancel();
      const previous = utils.userCard.getList.getData();
      const tempId = `temp-${Date.now()}`;
      const now = new Date().toISOString();
      utils.userCard.getList.setData(undefined, (old) => [
        {
          id: tempId,
          language: input.language ?? null,
          variant: input.variant ?? null,
          condition: input.condition ?? null,
          notes: input.notes ?? null,
          card: { ...card, created_at: now, updated_at: now, price: undefined },
          localizedName: null,
          photos: input.photos ?? [],
          coverPhoto: input.coverPhotoUrl ?? null,
          coverCrop: input.coverCrop ?? null,
        },
        ...(old ?? []),
      ]);
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined) {
        utils.userCard.getList.setData(undefined, ctx.previous);
      }
    },
    onSettled: () => void utils.userCard.getList.invalidate(),
  });

  const updateCardMutation = api.userCard.update.useMutation({
    onMutate: async (input) => {
      await utils.userCard.getList.cancel();
      const previous = utils.userCard.getList.getData();
      utils.userCard.getList.setData(undefined, (old) =>
        old?.map((c) =>
          c.id === input.id
            ? {
                ...c,
                language: input.language ?? null,
                variant: input.variant ?? null,
                condition: input.condition ?? null,
                notes: input.notes ?? null,
                photos: input.photos ?? c.photos,
                coverPhoto: input.coverPhotoUrl ?? null,
                coverCrop: input.coverCrop ?? null,
              }
            : c,
        ),
      );
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined) {
        utils.userCard.getList.setData(undefined, ctx.previous);
      }
    },
    onSettled: () => void utils.userCard.getList.invalidate(),
  });

  const deleteCardMutation = api.userCard.delete.useMutation({
    onMutate: async ({ id }) => {
      await utils.userCard.getList.cancel();
      const previous = utils.userCard.getList.getData();
      utils.userCard.getList.setData(undefined, (old) =>
        old?.filter((c) => c.id !== id),
      );
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined) {
        utils.userCard.getList.setData(undefined, ctx.previous);
      }
    },
    onSettled: () => void utils.userCard.getList.invalidate(),
  });

  // ---------------------------------------------------------------------------
  // userSet mutations (list-level — place/unplace/autoPlace stay in binder components)
  // ---------------------------------------------------------------------------

  const createSetMutation = api.userSet.create.useMutation({
    onMutate: async (input) => {
      await utils.userSet.getList.cancel();
      const previous = utils.userSet.getList.getData();
      const tempId = `temp-${Date.now()}`;
      utils.userSet.getList.setData(undefined, (old) => [
        {
          id: tempId,
          name: input.name,
          image: input.image ?? null,
          preferredLanguage: input.preferredLanguage ?? null,
          preferredVariant: input.preferredVariant ?? null,
          preferredCondition: input.preferredCondition ?? null,
          binderLayout: input.binderLayout ?? "3x3",
          totalCards: input.cardData.length,
          placedCards: 0,
        },
        ...(old ?? []),
      ]);
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined) {
        utils.userSet.getList.setData(undefined, ctx.previous);
      }
      toast.error(
        intl.formatMessage({
          id: "page.set.action.create.error",
          defaultMessage: "Failed to create set.",
        }),
      );
    },
    onSettled: () => void utils.userSet.getList.invalidate(),
  });

  const updateSetMutation = api.userSet.update.useMutation({
    onMutate: async (input) => {
      await utils.userSet.getList.cancel();
      const previousList = utils.userSet.getList.getData();
      utils.userSet.getList.setData(undefined, (old) =>
        old?.map((s) =>
          s.id === input.id
            ? {
                ...s,
                name: input.name,
                image: input.image ?? s.image,
                preferredLanguage: input.preferredLanguage ?? null,
                preferredVariant: input.preferredVariant ?? null,
                preferredCondition: input.preferredCondition ?? null,
                binderLayout: input.binderLayout ?? s.binderLayout,
              }
            : s,
        ),
      );
      return { previousList };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previousList !== undefined) {
        utils.userSet.getList.setData(undefined, ctx.previousList);
      }
      toast.error(
        intl.formatMessage({
          id: "page.set.action.save.error",
          defaultMessage: "Failed to save set.",
        }),
      );
    },
    onSettled: (_data, _err, input) => {
      void utils.userSet.getList.invalidate();
      void utils.userSet.getById.invalidate({ id: input.id });
    },
  });

  const deleteSetMutation = api.userSet.deleteById.useMutation({
    onMutate: async ({ id }) => {
      await utils.userSet.getList.cancel();
      const previous = utils.userSet.getList.getData();
      utils.userSet.getList.setData(undefined, (old) =>
        old?.filter((s) => s.id !== id),
      );
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined) {
        utils.userSet.getList.setData(undefined, ctx.previous);
      }
      toast.error(
        intl.formatMessage({
          id: "page.set.action.delete.error",
          defaultMessage: "Failed to delete set.",
        }),
      );
    },
    onSettled: () => void utils.userSet.getList.invalidate(),
  });

  const reorderSetsMutation = api.userSet.reorder.useMutation({
    onMutate: async ({ ids }) => {
      await utils.userSet.getList.cancel();
      const previous = utils.userSet.getList.getData();
      utils.userSet.getList.setData(undefined, (old) => {
        if (!old) return old;
        const map = new Map(old.map((s) => [s.id, s]));
        return ids.map((id) => map.get(id)!).filter(Boolean);
      });
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined) {
        utils.userSet.getList.setData(undefined, ctx.previous);
      }
    },
    onSettled: () => void utils.userSet.getList.invalidate(),
  });

  // ---------------------------------------------------------------------------
  // wantlistShareLink mutations
  // ---------------------------------------------------------------------------

  const createShareLinkMutation = api.wantlistShareLink.create.useMutation({
    onMutate: async (input) => {
      await utils.wantlistShareLink.list.cancel();
      const previous = utils.wantlistShareLink.list.getData();
      const tempId = crypto.randomUUID();
      utils.wantlistShareLink.list.setData(undefined, (old) => [
        ...(old ?? []),
        {
          id: tempId,
          user_id: "",
          label: input.label ?? null,
          set_ids: input.userSetIds ?? null,
          is_snapshot: input.isSnapshot ?? false,
          snapshot_data: null,
          expires_at: input.expiresAt ?? null,
          last_accessed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          setNames: null,
        },
      ]);
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined) {
        utils.wantlistShareLink.list.setData(undefined, ctx.previous);
      }
    },
    onSettled: () => void utils.wantlistShareLink.list.invalidate(),
  });

  const revokeShareLinkMutation = api.wantlistShareLink.revoke.useMutation({
    onMutate: async ({ id }) => {
      await utils.wantlistShareLink.list.cancel();
      const previous = utils.wantlistShareLink.list.getData();
      utils.wantlistShareLink.list.setData(undefined, (old) =>
        old?.filter((l) => l.id !== id),
      );
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined) {
        utils.wantlistShareLink.list.setData(undefined, ctx.previous);
      }
    },
    onSettled: () => void utils.wantlistShareLink.list.invalidate(),
  });

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  return {
    card: {
      /** Create a card. The `card` object is required for the optimistic list item. */
      create: (input: RouterInputs["userCard"]["create"], card: Card) => {
        cardForCreateRef.current = card;
        createCardMutation.mutate(input);
      },
      isCreating: createCardMutation.isPending,

      update: (input: RouterInputs["userCard"]["update"]) =>
        updateCardMutation.mutate(input),
      isUpdating: updateCardMutation.isPending,

      delete: (id: string) => deleteCardMutation.mutate({ id }),
      isDeleting: deleteCardMutation.isPending,
    },

    set: {
      create: (input: RouterInputs["userSet"]["create"]) =>
        createSetMutation.mutate(input),
      isCreating: createSetMutation.isPending,

      update: (input: RouterInputs["userSet"]["update"]) =>
        updateSetMutation.mutate(input),
      isUpdating: updateSetMutation.isPending,

      delete: (id: string) => deleteSetMutation.mutate({ id }),
      isDeleting: deleteSetMutation.isPending,

      reorder: (ids: string[]) => reorderSetsMutation.mutate({ ids }),
      isReordering: reorderSetsMutation.isPending,
    },

    shareLink: {
      /** Create a share link. Pass `onSuccess` to react to completion (e.g. close a form). */
      create: (
        input: RouterInputs["wantlistShareLink"]["create"],
        onSuccess?: () => void,
      ) => createShareLinkMutation.mutate(input, { onSuccess }),
      isCreating: createShareLinkMutation.isPending,

      revoke: (id: string) => revokeShareLinkMutation.mutate({ id }),
      isRevoking: revokeShareLinkMutation.isPending,
    },
  };
}
