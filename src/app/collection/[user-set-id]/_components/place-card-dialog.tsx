"use client";

import { Button } from "@/components/ui/button";
import ConfirmButton from "@/components/confirm-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api/react";
import { AppRouter } from "@/lib/api/routers/_app";
import { conditionEnum, languageEnum, variantEnum } from "@/lib/db/enums";
import { RHFForm, useRHFForm } from "@/lib/form/utils";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useIntl } from "react-intl";
import z from "zod";

type UserCard = Awaited<ReturnType<AppRouter["userCard"]["getList"]>>[number];
type UserSet = Awaited<ReturnType<AppRouter["userSet"]["getById"]>>;

interface PlaceCardDialogProps {
  userSetId: string;
  userSet: UserSet;
  cardId: string;
  userSetCardId: string;
  hasUserCard: boolean;
  isPlaced: boolean;
  currentUserCardId: string | null;
  userCards: UserCard[];
  onClose: () => void;
  onSuccess: () => void;
}

const FormSchema = z.object({
  condition: z.enum(conditionEnum.enumValues),
  language: z.enum(languageEnum.enumValues),
  variant: z.enum(variantEnum.enumValues),
});

export function PlaceCardDialog({
  userSetId,
  userSet,
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

  const { data: card } = api.card.getById.useQuery({ cardId });
  const { data: placedUserCards } = api.userSet.getPlacedUserCardIds.useQuery();
  const { mutateAsync: placeCard, isPending: isPlacing } =
    api.userSet.placeCard.useMutation();
  const { mutateAsync: unplaceCard, isPending: isUnplacing } =
    api.userSet.unplaceCard.useMutation();
  const { mutateAsync: createUserCard, isPending: isCreating } =
    api.userCard.create.useMutation();
  const apiUtils = api.useUtils();

  const form = useRHFForm(FormSchema, {
    defaultValues: {
      condition: userSet.set.preferredCondition ?? "Near Mint",
      language: userSet.set.preferredLanguage ?? "en",
      variant: userSet.set.preferredVariant ?? "Unlimited",
    },
  });

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

  const handleSelectUserCard = async (userCardId: string) => {
    try {
      // Check if this card is already placed elsewhere
      const placement = placedCardsMap.get(userCardId);
      if (placement && placement.userSetId !== userSetId) {
        // Unplace it from the old set first
        await unplaceCard({ userSetCardId: placement.userSetCardId });
        // Invalidate the old set's cache
        await apiUtils.userSet.getById.invalidate({ id: placement.userSetId });
      }

      await placeCard({ userSetCardId, userCardId });
      await apiUtils.userSet.getById.invalidate({ id: userSetId });
      await apiUtils.userSet.getPlacedUserCardIds.invalidate();
      onSuccess();
    } catch (error: any) {
      // Error will be shown by tRPC, just log it
      console.error("Failed to place card:", error.message);
    }
  };

  const handleUnplace = async () => {
    await unplaceCard({ userSetCardId });
    await apiUtils.userSet.getById.invalidate({ id: userSetId });
    await apiUtils.userSet.getPlacedUserCardIds.invalidate();
    onSuccess();
  };

  const handleCreateAndPlace = async (data: z.infer<typeof FormSchema>) => {
    const newUserCard = await createUserCard({
      cardId,
      condition: data.condition,
      language: data.language,
      variant: data.variant,
    });

    try {
      await placeCard({ userSetCardId, userCardId: newUserCard.id });
      await apiUtils.userSet.getById.invalidate({ id: userSetId });
      await apiUtils.userSet.getPlacedUserCardIds.invalidate();
      await apiUtils.userCard.getList.invalidate();
      onSuccess();
    } catch (error: any) {
      // If placing fails, we still created the card, so just close
      console.error("Failed to place card:", error.message);
      await apiUtils.userCard.getList.invalidate();
      onSuccess();
    }
  };

  if (!card) {
    return null;
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
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

        <div className="py-4">
          <div className="flex gap-4 mb-6">
            <Image
              src={card.imageSmall}
              alt={card.name}
              width={128}
              height={179}
              unoptimized
              className="w-32 h-auto object-contain rounded"
            />
            <div>
              <h3 className="text-xl font-bold">{card.name}</h3>
              <p className="text-sm text-muted-foreground">
                #{card.number} · {card.rarity}
              </p>
            </div>
          </div>

          {isPlaced && currentlyPlacedCard && (
            <div className="mb-6 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">
                  {intl.formatMessage({
                    id: "dialog.place_card.currently_placed",
                    defaultMessage: "Currently Placed",
                  })}
                </h4>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleUnplace}
                  disabled={isUnplacing}
                >
                  {intl.formatMessage({
                    id: "dialog.place_card.action.unplace",
                    defaultMessage: "Unplace",
                  })}
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <Image
                  src={currentlyPlacedCard.card.imageSmall ?? ""}
                  alt={currentlyPlacedCard.card.name ?? ""}
                  width={64}
                  height={89}
                  unoptimized
                  className="w-16 h-auto object-contain rounded"
                />
                <div>
                  <div className="font-medium">
                    {currentlyPlacedCard.card.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {currentlyPlacedCard.language} ·{" "}
                    {currentlyPlacedCard.variant} ·{" "}
                    {currentlyPlacedCard.condition}
                  </div>
                </div>
              </div>
            </div>
          )}

          {hasUserCard && (
            <div className="flex gap-2 mb-4">
              <Button
                variant={mode === "select" ? "default" : "outline"}
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

          {mode === "select" ? (
            <>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {matchingUserCards
                    .filter(
                      (uc) =>
                        uc.id !== currentUserCardId &&
                        (!uc.isPlacedElsewhere || showCardsFromOtherSets),
                    )
                    .map((userCard) => {
                      const isCurrentlyPlaced =
                        userCard.id === currentUserCardId;

                      return (
                        <div
                          key={userCard.id}
                          className={cn(
                            "w-full p-3 rounded border",
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
                              className="w-16 h-auto object-contain rounded"
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
                                      {
                                        setName:
                                          userCard.placementInfo?.setName,
                                      },
                                    )}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {userCard.language} · {userCard.variant} ·{" "}
                                {userCard.condition}
                              </div>
                            </div>
                            {!isCurrentlyPlaced &&
                              (userCard.isPlacedElsewhere ? (
                                <ConfirmButton
                                  variant="destructive"
                                  size="sm"
                                  title={intl.formatMessage({
                                    id: "dialog.place_card.confirm.title",
                                    defaultMessage:
                                      "Move Card from Another Set?",
                                  })}
                                  description={intl.formatMessage(
                                    {
                                      id: "dialog.place_card.confirm.description",
                                      defaultMessage:
                                        'This card is currently placed in "{setName}". Moving it here will remove it from that set. Do you want to continue?',
                                    },
                                    {
                                      setName: userCard.placementInfo?.setName,
                                    },
                                  )}
                                  confirmLabel={intl.formatMessage({
                                    id: "dialog.place_card.confirm.confirm_label",
                                    defaultMessage: "Move Card",
                                  })}
                                  destructive
                                  onClick={() =>
                                    handleSelectUserCard(userCard.id)
                                  }
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
                                  onClick={() =>
                                    handleSelectUserCard(userCard.id)
                                  }
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
                    })}
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
            </>
          ) : (
            <RHFForm form={form} onSubmit={handleCreateAndPlace}>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {intl.formatMessage({
                      id: "form.field.language.label",
                      defaultMessage: "Language",
                    })}
                  </label>
                  <select
                    {...form.register("language")}
                    className="w-full p-2 rounded border bg-background"
                  >
                    {languageEnum.enumValues.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {intl.formatMessage({
                      id: "form.field.variant.label",
                      defaultMessage: "Variant",
                    })}
                  </label>
                  <select
                    {...form.register("variant")}
                    className="w-full p-2 rounded border bg-background"
                  >
                    {variantEnum.enumValues.map((variant) => (
                      <option key={variant} value={variant}>
                        {variant}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {intl.formatMessage({
                      id: "form.field.condition.label",
                      defaultMessage: "Condition",
                    })}
                  </label>
                  <select
                    {...form.register("condition")}
                    className="w-full p-2 rounded border bg-background"
                  >
                    {conditionEnum.enumValues.map((condition) => (
                      <option key={condition} value={condition}>
                        {condition}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isCreating}
                >
                  {intl.formatMessage({
                    id: "common.button.cancel",
                    defaultMessage: "Cancel",
                  })}
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating
                    ? intl.formatMessage({
                        id: "common.button.saving",
                        defaultMessage: "Saving...",
                      })
                    : intl.formatMessage({
                        id: "dialog.place_card.action.add_and_place",
                        defaultMessage: "Add New Card to Collection & Place It",
                      })}
                </Button>
              </DialogFooter>
            </RHFForm>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
