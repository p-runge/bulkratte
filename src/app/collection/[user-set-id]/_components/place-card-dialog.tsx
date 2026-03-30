"use client";

import UserCardDialog from "@/app/collection/_components/my-cards-tab/user-card-dialog";
import { CardFormSection } from "@/components/card-form-section";
import { ConditionBadge } from "@/components/condition-badge";
import ConfirmButton from "@/components/confirm-button";
import {
  MultiPhotoUpload,
  useMultiPhotoUpload,
} from "@/components/image-upload";
import { InfoTooltip } from "@/components/info-tooltip";
import { LanguageBadge } from "@/components/language-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/react";
import { AppRouter } from "@/lib/api/routers/_app";
import { BinderCard } from "@/components/binder/types";
import { CARD_BORDER_RADIUS } from "@/lib/card-config";
import { RHFForm, useRHFForm } from "@/lib/form/utils";
import { userCardFormSchema } from "@/lib/schemas/user-card";
import { cn } from "@/lib/utils";
import { Pencil, Plus } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { useIntl } from "react-intl";
import z from "zod";

type UserCard = Awaited<ReturnType<AppRouter["userCard"]["getList"]>>[number];
type UserSet = Awaited<ReturnType<AppRouter["userSet"]["getById"]>>;

interface PlaceCardDialogProps {
  userSetId: string;
  userSet: UserSet;
  card: BinderCard | undefined;
  cardId: string;
  userSetCardId: string;
  hasUserCard: boolean;
  isPlaced: boolean;
  currentUserCardId: string | null;
  userCards: UserCard[];
  onClose: () => void;
  onSuccess: () => void;
}

export function PlaceCardDialog({
  userSetId,
  userSet,
  card,
  cardId,
  userSetCardId,
  hasUserCard,
  isPlaced,
  currentUserCardId,
  userCards,
  onClose,
  onSuccess,
}: PlaceCardDialogProps) {
  const intl = useIntl();
  const [mode, setMode] = useState<"select" | "create">(
    hasUserCard ? "select" : "create",
  );
  const [showCardsFromOtherSets, setShowCardsFromOtherSets] = useState(false);
  const [editingUserCard, setEditingUserCard] = useState<UserCard | null>(null);

  const { data: placedUserCards } = api.userSet.getPlacedUserCardIds.useQuery();
  const { mutateAsync: placeCard, isPending: isPlacing } =
    api.userSet.placeCard.useMutation();
  const { mutateAsync: unplaceCard, isPending: isUnplacing } =
    api.userSet.unplaceCard.useMutation();
  const { mutateAsync: createUserCard } = api.userCard.create.useMutation();
  const apiUtils = api.useUtils();

  const form = useRHFForm(userCardFormSchema, {
    defaultValues: {
      condition: userSet.set.preferredCondition ?? null,
      language: userSet.set.preferredLanguage ?? null,
      variant: userSet.set.preferredVariant ?? null,
      notes: "",
    },
  });

  const photoUpload = useMultiPhotoUpload();

  // Create a map of user_card_id to the set it's placed in
  const placedCardsMap = new Map(
    (placedUserCards ?? []).map((pc) => [
      pc.userCardId,
      {
        userSetId: pc.userSetId,
        userSetCardId: pc.userSetCardId,
        setName: pc.setName,
      },
    ]),
  );

  // Filter user cards to only show those matching this cardId and not already placed elsewhere
  const matchingUserCards = userCards
    .filter((uc) => uc.card.id === cardId)
    .map((uc) => {
      const placement = placedCardsMap.get(uc.id);
      const isPlacedElsewhere = placement && placement.userSetId !== userSetId;
      return {
        ...uc,
        isPlacedElsewhere,
        placementInfo: isPlacedElsewhere ? placement : null,
      };
    });

  // Find the currently placed user card
  const currentlyPlacedCard = currentUserCardId
    ? userCards.find((uc) => uc.id === currentUserCardId)
    : null;

  // Find the specific card slot in the set
  const userSetCard = userSet.cards.find((c) => c.id === userSetCardId);

  // Helper function to check if a card matches the preferences
  const matchesPreferences = (userCard: UserCard) => {
    // Check card-level preferences first (they take precedence)
    const cardLevelLanguage = userSetCard?.preferredLanguage;
    const cardLevelVariant = userSetCard?.preferredVariant;
    const cardLevelCondition = userSetCard?.preferredCondition;

    // Then check set-level preferences
    const setLevelLanguage = userSet.set.preferredLanguage;
    const setLevelVariant = userSet.set.preferredVariant;
    const setLevelCondition = userSet.set.preferredCondition;

    // Use card-level if set, otherwise fall back to set-level
    const preferredLanguage = cardLevelLanguage ?? setLevelLanguage;
    const preferredVariant = cardLevelVariant ?? setLevelVariant;
    const preferredCondition = cardLevelCondition ?? setLevelCondition;

    // If a preference is set, the card must have that exact value to match
    if (preferredLanguage && userCard.language !== preferredLanguage) {
      return false;
    }
    if (preferredVariant && userCard.variant !== preferredVariant) {
      return false;
    }
    if (preferredCondition && userCard.condition !== preferredCondition) {
      return false;
    }

    return true;
  };

  // Separate cards into matching and non-matching
  const filteredCards = matchingUserCards.filter(
    (uc) =>
      uc.id !== currentUserCardId &&
      (!uc.isPlacedElsewhere || showCardsFromOtherSets),
  );

  // Check if any preferences are defined (card-level or set-level)
  const hasPreferences =
    userSetCard?.preferredCondition ||
    userSetCard?.preferredLanguage ||
    userSetCard?.preferredVariant ||
    userSet.set.preferredCondition ||
    userSet.set.preferredLanguage ||
    userSet.set.preferredVariant;

  const matchingCards = filteredCards.filter(matchesPreferences);
  const nonMatchingCards = hasPreferences
    ? filteredCards.filter((uc) => !matchesPreferences(uc))
    : [];

  const handleSelectUserCard = async (userCardId: string) => {
    const placement = placedCardsMap.get(userCardId);
    const setName = userSet.set.name;

    // Snapshot for rollback
    const prevById = apiUtils.userSet.getById.getData({ id: userSetId });
    const prevPlaced = apiUtils.userSet.getPlacedUserCardIds.getData();

    // Optimistic: update this slot's userCardId
    apiUtils.userSet.getById.setData({ id: userSetId }, (old) =>
      old
        ? {
            ...old,
            cards: old.cards.map((c) =>
              c.id === userSetCardId ? { ...c, userCardId } : c,
            ),
          }
        : old,
    );

    // Optimistic: update placed IDs (remove old placement of this card, add new)
    apiUtils.userSet.getPlacedUserCardIds.setData(undefined, (old) => {
      const filtered = (old ?? []).filter(
        (p) => p.userSetCardId !== userSetCardId && p.userCardId !== userCardId,
      );
      return [...filtered, { userCardId, userSetId, userSetCardId, setName }];
    });

    // If card was placed elsewhere, optimistically clear that slot too
    if (placement && placement.userSetId !== userSetId) {
      apiUtils.userSet.getById.setData({ id: placement.userSetId }, (old) =>
        old
          ? {
              ...old,
              cards: old.cards.map((c) =>
                c.id === placement.userSetCardId
                  ? { ...c, userCardId: null }
                  : c,
              ),
            }
          : old,
      );
    }

    onSuccess();

    try {
      if (placement && placement.userSetId !== userSetId) {
        await unplaceCard({ userSetCardId: placement.userSetCardId });
        void apiUtils.userSet.getById.invalidate({ id: placement.userSetId });
      }
      await placeCard({ userSetCardId, userCardId });
    } catch (error: any) {
      // Rollback on error
      if (prevById !== undefined) {
        apiUtils.userSet.getById.setData({ id: userSetId }, prevById);
      }
      if (prevPlaced !== undefined) {
        apiUtils.userSet.getPlacedUserCardIds.setData(undefined, prevPlaced);
      }
      console.error("Failed to place card:", error.message);
    } finally {
      void apiUtils.userSet.getById.invalidate({ id: userSetId });
      void apiUtils.userSet.getPlacedUserCardIds.invalidate();
    }
  };

  const handleUnplace = async () => {
    const prevById = apiUtils.userSet.getById.getData({ id: userSetId });
    const prevPlaced = apiUtils.userSet.getPlacedUserCardIds.getData();

    // Optimistic: clear the slot
    apiUtils.userSet.getById.setData({ id: userSetId }, (old) =>
      old
        ? {
            ...old,
            cards: old.cards.map((c) =>
              c.id === userSetCardId ? { ...c, userCardId: null } : c,
            ),
          }
        : old,
    );

    // Optimistic: remove from placed IDs
    apiUtils.userSet.getPlacedUserCardIds.setData(undefined, (old) =>
      old?.filter((p) => p.userSetCardId !== userSetCardId),
    );

    onSuccess();

    try {
      await unplaceCard({ userSetCardId });
    } catch (error) {
      if (prevById !== undefined) {
        apiUtils.userSet.getById.setData({ id: userSetId }, prevById);
      }
      if (prevPlaced !== undefined) {
        apiUtils.userSet.getPlacedUserCardIds.setData(undefined, prevPlaced);
      }
    } finally {
      void apiUtils.userSet.getById.invalidate({ id: userSetId });
      void apiUtils.userSet.getPlacedUserCardIds.invalidate();
    }
  };

  const handleCreateAndPlace = async (
    data: z.infer<typeof userCardFormSchema>,
  ) => {
    const tempId = crypto.randomUUID();
    const setName = userSet.set.name;

    const prevUserCards = apiUtils.userCard.getList.getData();
    const prevById = apiUtils.userSet.getById.getData({ id: userSetId });
    const prevPlaced = apiUtils.userSet.getPlacedUserCardIds.getData();

    // Optimistic: add the new user card to the local collection list
    if (card) {
      apiUtils.userCard.getList.setData(undefined, (old) => {
        if (!old) return old;
        return [
          ...old,
          {
            id: tempId,
            language: data.language ?? null,
            variant: data.variant ?? null,
            condition: data.condition ?? null,
            notes: data.notes || null,
            card: {
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              id: card.id,
              name: card.name,
              number: card.number,
              rarity: card.rarity ?? null,
              imageSmall: card.imageSmall,
              imageLarge: card.imageLarge,
              setId: card.setId,
              price: undefined,
            },
            localizedName: null,
            photos: [],
            coverPhoto: null,
            coverCrop: null,
          } as unknown as UserCard,
        ];
      });
    }

    // Optimistic: place the temp card in the slot
    apiUtils.userSet.getById.setData({ id: userSetId }, (old) =>
      old
        ? {
            ...old,
            cards: old.cards.map((c) =>
              c.id === userSetCardId ? { ...c, userCardId: tempId } : c,
            ),
          }
        : old,
    );

    // Optimistic: add to placed IDs
    apiUtils.userSet.getPlacedUserCardIds.setData(undefined, (old) => [
      ...(old ?? []).filter((p) => p.userSetCardId !== userSetCardId),
      { userCardId: tempId, userSetId, userSetCardId, setName },
    ]);

    // Close dialog immediately
    onSuccess();

    try {
      const { photos, coverPhotoUrl, coverCrop } =
        await photoUpload.uploadPending();
      const newUserCard = await createUserCard({
        cardId,
        condition: data.condition ?? undefined,
        language: data.language ?? undefined,
        variant: data.variant ?? undefined,
        notes: data.notes || undefined,
        photos: photos.length > 0 ? photos : undefined,
        coverPhotoUrl: coverPhotoUrl ?? undefined,
        coverCrop,
      });

      // Replace temp ID with the real ID from the server
      apiUtils.userCard.getList.setData(undefined, (old) =>
        old
          ? old.map((uc) =>
              uc.id === tempId
                ? {
                    ...uc,
                    id: newUserCard.id,
                    photos,
                    coverPhoto: coverPhotoUrl ?? null,
                    coverCrop: coverCrop ?? null,
                  }
                : uc,
            )
          : old,
      );

      apiUtils.userSet.getById.setData({ id: userSetId }, (old) =>
        old
          ? {
              ...old,
              cards: old.cards.map((c) =>
                c.id === userSetCardId
                  ? { ...c, userCardId: newUserCard.id }
                  : c,
              ),
            }
          : old,
      );

      apiUtils.userSet.getPlacedUserCardIds.setData(undefined, (old) =>
        old
          ? old.map((p) =>
              p.userCardId === tempId
                ? { ...p, userCardId: newUserCard.id }
                : p,
            )
          : old,
      );

      await placeCard({ userSetCardId, userCardId: newUserCard.id });
    } catch (error: any) {
      if (prevUserCards !== undefined) {
        apiUtils.userCard.getList.setData(undefined, prevUserCards);
      }
      if (prevById !== undefined) {
        apiUtils.userSet.getById.setData({ id: userSetId }, prevById);
      }
      if (prevPlaced !== undefined) {
        apiUtils.userSet.getPlacedUserCardIds.setData(undefined, prevPlaced);
      }
      console.error("Failed to create and place card:", error.message);
    } finally {
      void apiUtils.userSet.getById.invalidate({ id: userSetId });
      void apiUtils.userSet.getPlacedUserCardIds.invalidate();
      void apiUtils.userCard.getList.invalidate();
    }
  };

  if (editingUserCard) {
    return (
      <UserCardDialog
        mode="edit"
        userCard={editingUserCard}
        onClose={() => setEditingUserCard(null)}
      />
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        className={mode === "select" ? "max-w-2xl" : "w-5xl sm:max-w-screen"}
      >
        <DialogHeader>
          <DialogTitle>
            {isPlaced
              ? intl.formatMessage({
                  id: "dialog.place_card.title.change",
                  defaultMessage: "Change Placed Card",
                })
              : intl.formatMessage({
                  id: "dialog.place_card.title.place",
                  defaultMessage: "Place Card in Binder",
                })}
          </DialogTitle>
        </DialogHeader>

        {mode === "select" ? (
          <div className="overflow-y-auto max-h-[70vh]">
            {isPlaced && currentlyPlacedCard && (
              <CurrentlyPlacedCardPanel
                userCard={currentlyPlacedCard}
                isUnplacing={isUnplacing}
                onEdit={() => setEditingUserCard(currentlyPlacedCard)}
                onUnplace={handleUnplace}
              />
            )}

            {hasUserCard && (
              <div className="flex gap-2 mb-4">
                <Button onClick={() => setMode("select")} size="sm">
                  {intl.formatMessage({
                    id: "dialog.place_card.mode.select_existing",
                    defaultMessage: "Select from Collection",
                  })}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setMode("create")}
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {intl.formatMessage({
                    id: "dialog.place_card.mode.add_new",
                    defaultMessage: "Add New",
                  })}
                </Button>
              </div>
            )}

            <ScrollArea className="h-64">
              <div className="space-y-4">
                {hasPreferences && matchingCards.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">
                      {intl.formatMessage({
                        id: "dialog.place_card.section.matching_preferences",
                        defaultMessage: "Matching Preferences",
                      })}
                    </h4>
                    <div className="space-y-2">
                      {matchingCards.map((userCard) => (
                        <PlacableCardRow
                          key={userCard.id}
                          userCard={userCard}
                          isCurrentlyPlaced={userCard.id === currentUserCardId}
                          isPlacing={isPlacing}
                          onSelect={handleSelectUserCard}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {!hasPreferences &&
                  filteredCards.map((userCard) => (
                    <PlacableCardRow
                      key={userCard.id}
                      userCard={userCard}
                      isCurrentlyPlaced={userCard.id === currentUserCardId}
                      isPlacing={isPlacing}
                      onSelect={handleSelectUserCard}
                    />
                  ))}

                {hasPreferences && nonMatchingCards.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
                      {intl.formatMessage({
                        id: "dialog.place_card.section.not_matching_preferences",
                        defaultMessage: "Not Matching Preferences",
                      })}
                    </h4>
                    <div className="space-y-2">
                      {nonMatchingCards.map((userCard) => (
                        <PlacableCardRow
                          key={userCard.id}
                          userCard={userCard}
                          isCurrentlyPlaced={userCard.id === currentUserCardId}
                          isPlacing={isPlacing}
                          dimmed
                          onSelect={handleSelectUserCard}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {matchingUserCards.some((uc) => uc.isPlacedElsewhere) && (
              <div className="mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setShowCardsFromOtherSets(!showCardsFromOtherSets)
                  }
                  className="w-full"
                >
                  {showCardsFromOtherSets
                    ? intl.formatMessage({
                        id: "dialog.place_card.filter.hide_other_sets",
                        defaultMessage: "Hide cards from other sets",
                      })
                    : intl.formatMessage({
                        id: "dialog.place_card.filter.show_other_sets",
                        defaultMessage: "Show cards from other sets",
                      })}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <RHFForm
            form={form}
            onSubmit={handleCreateAndPlace}
            className="flex flex-col"
          >
            <div className="overflow-y-auto max-h-[70vh]">
              {isPlaced && currentlyPlacedCard && (
                <CurrentlyPlacedCardPanel
                  userCard={currentlyPlacedCard}
                  isUnplacing={isUnplacing}
                  onEdit={() => setEditingUserCard(currentlyPlacedCard)}
                  onUnplace={handleUnplace}
                />
              )}

              {hasUserCard && (
                <div className="flex gap-2 mb-4">
                  <Button
                    variant="outline"
                    onClick={() => setMode("select")}
                    size="sm"
                  >
                    {intl.formatMessage({
                      id: "dialog.place_card.mode.select_existing",
                      defaultMessage: "Select from Collection",
                    })}
                  </Button>
                  <Button
                    variant={mode === "create" ? "default" : "outline"}
                    onClick={() => setMode("create")}
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {intl.formatMessage({
                      id: "dialog.place_card.mode.add_new",
                      defaultMessage: "Add New",
                    })}
                  </Button>
                </div>
              )}

              {card ? (
                <CardFormSection
                  card={card}
                  control={form.control}
                  mediaSlot={
                    <MultiPhotoUpload
                      photos={photoUpload.photos}
                      coverIndex={photoUpload.coverIndex}
                      coverCrop={photoUpload.coverCrop}
                      fileInputRef={photoUpload.fileInputRef}
                      onAddPhotos={photoUpload.handleAddPhotos}
                      onAddFiles={photoUpload.addFiles}
                      onRemovePhoto={photoUpload.handleRemovePhoto}
                      onSetCover={photoUpload.handleSetCover}
                      onSetCoverCrop={photoUpload.handleSetCoverCrop}
                      fallbackSrc={card.imageSmall}
                      fallbackAlt={card.name}
                    />
                  }
                >
                  {/* Notes */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="place-notes"
                      className="flex items-center gap-1.5"
                    >
                      {intl.formatMessage({
                        id: "form.field.notes.label",
                        defaultMessage: "Notes",
                      })}
                      <InfoTooltip
                        content={intl.formatMessage({
                          id: "form.field.notes.placeholder",
                          defaultMessage:
                            "Self-pulled\nReceived from John\nCreased corner\nScratched foil\nSwirl on the right\n…",
                        })}
                      />
                    </Label>
                    <Controller
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <Textarea
                          id="place-notes"
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      )}
                    />
                  </div>
                </CardFormSection>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
                  <Skeleton
                    className="w-full sm:w-48 sm:flex-shrink-0 aspect-5/7 mx-auto sm:mx-0"
                    style={{ borderRadius: CARD_BORDER_RADIUS }}
                  />
                  <div className="flex-1 space-y-4 sm:space-y-6 w-full">
                    <Skeleton className="h-7 w-48" />
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                {intl.formatMessage({
                  id: "common.button.cancel",
                  defaultMessage: "Cancel",
                })}
              </Button>
              <Button type="submit" disabled={!card}>
                {intl.formatMessage({
                  id: "dialog.place_card.action.add_and_place",
                  defaultMessage: "Add New Card to Collection & Place It",
                })}
              </Button>
            </DialogFooter>
          </RHFForm>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PlacableCardRow({
  userCard,
  isCurrentlyPlaced,
  isPlacing,
  dimmed,
  onSelect,
}: {
  userCard: UserCard & {
    isPlacedElsewhere?: boolean;
    placementInfo?: { setName: string | undefined } | null;
  };
  isCurrentlyPlaced: boolean;
  isPlacing: boolean;
  dimmed?: boolean;
  onSelect: (userCardId: string) => void;
}) {
  const intl = useIntl();

  return (
    <div
      className={cn(
        "w-full p-3 rounded border",
        dimmed && "opacity-60",
        isCurrentlyPlaced
          ? "bg-primary/10 border-primary"
          : userCard.isPlacedElsewhere
            ? "border-destructive"
            : "",
      )}
    >
      <div className="flex items-center gap-3">
        <Image
          src={userCard.card.imageSmall ?? ""}
          alt={userCard.card.name ?? ""}
          width={64}
          height={89}
          unoptimized
          className="w-16 h-auto object-cover"
          style={{ borderRadius: CARD_BORDER_RADIUS }}
        />
        <div className="flex-1">
          <div className="font-medium">
            {userCard.card.name}
            {isCurrentlyPlaced && (
              <span className="ml-2 text-xs text-primary">
                {intl.formatMessage({
                  id: "dialog.place_card.label.currently_placed",
                  defaultMessage: "(Currently Placed)",
                })}
              </span>
            )}
            {userCard.isPlacedElsewhere && (
              <span className="ml-2 text-xs text-muted-foreground">
                {intl.formatMessage(
                  {
                    id: "dialog.place_card.label.placed_elsewhere",
                    defaultMessage: '(In "{setName}")',
                  },
                  { setName: userCard.placementInfo?.setName },
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            {userCard.language && (
              <Badge variant="outline" className="h-5.5">
                <LanguageBadge code={userCard.language} className="text-sm" />
              </Badge>
            )}
            {userCard.variant && (
              <Badge variant="outline" className="text-xs">
                {userCard.variant}
              </Badge>
            )}
            {userCard.condition && (
              <ConditionBadge condition={userCard.condition} />
            )}
          </div>
        </div>
        {!isCurrentlyPlaced &&
          (userCard.isPlacedElsewhere ? (
            <ConfirmButton
              variant="destructive"
              size="sm"
              title={intl.formatMessage({
                id: "dialog.place_card.confirm.title",
                defaultMessage: "Move Card from Another Set?",
              })}
              description={intl.formatMessage(
                {
                  id: "dialog.place_card.confirm.description",
                  defaultMessage:
                    'This card is currently placed in "{setName}". Moving it here will remove it from that set. Do you want to continue?',
                },
                { setName: userCard.placementInfo?.setName },
              )}
              confirmLabel={intl.formatMessage({
                id: "dialog.place_card.confirm.confirm_label",
                defaultMessage: "Move Card",
              })}
              destructive
              onClick={() => onSelect(userCard.id)}
              disabled={isPlacing}
            >
              {intl.formatMessage({
                id: "dialog.place_card.action.place",
                defaultMessage: "Place",
              })}
            </ConfirmButton>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => onSelect(userCard.id)}
              disabled={isPlacing}
            >
              {intl.formatMessage({
                id: "dialog.place_card.action.place",
                defaultMessage: "Place",
              })}
            </Button>
          ))}
      </div>
    </div>
  );
}

function CurrentlyPlacedCardPanel({
  userCard,
  isUnplacing,
  onEdit,
  onUnplace,
}: {
  userCard: UserCard;
  isUnplacing: boolean;
  onEdit: () => void;
  onUnplace: () => void;
}) {
  const intl = useIntl();

  return (
    <div className="mb-6 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold">
          {intl.formatMessage({
            id: "dialog.place_card.currently_placed",
            defaultMessage: "Currently Placed",
          })}
        </h4>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-1" />
            {intl.formatMessage({
              id: "common.button.edit",
              defaultMessage: "Edit",
            })}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onUnplace}
            disabled={isUnplacing}
          >
            {intl.formatMessage({
              id: "dialog.place_card.action.unplace",
              defaultMessage: "Unplace",
            })}
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Image
          src={userCard.card.imageSmall ?? ""}
          alt={userCard.card.name ?? ""}
          width={64}
          height={89}
          unoptimized
          className="w-16 h-auto object-cover"
          style={{ borderRadius: CARD_BORDER_RADIUS }}
        />
        <div>
          <div className="font-medium">{userCard.card.name}</div>
          <div className="flex items-center gap-1.5 mt-1">
            {userCard.language && (
              <Badge variant="outline" className="h-5.5">
                <LanguageBadge code={userCard.language} className="text-sm" />
              </Badge>
            )}
            {userCard.variant && (
              <Badge variant="outline" className="text-xs">
                {userCard.variant}
              </Badge>
            )}
            {userCard.condition && (
              <ConditionBadge condition={userCard.condition} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
