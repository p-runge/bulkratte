"use client";

import UserCardDialog from "@/app/collection/_components/my-cards-tab/user-card-dialog";
import { ConditionBadge } from "@/components/condition-badge";
import { ConditionToggleGroup } from "@/components/condition-toggle-group";
import ConfirmButton from "@/components/confirm-button";
import { LanguageBadge } from "@/components/language-badge";
import { LanguageToggleGroup } from "@/components/language-toggle-group";
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
import { VariantToggleGroup } from "@/components/variant-toggle-group";
import { api } from "@/lib/api/react";
import { AppRouter } from "@/lib/api/routers/_app";
import { conditionEnum, languageEnum, variantEnum } from "@/lib/db/enums";
import { RHFForm, useRHFForm } from "@/lib/form/utils";
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
  language: z.enum(languageEnum.enumValues).nullable(),
  variant: z.enum(variantEnum.enumValues).nullable(),
  condition: z.enum(conditionEnum.enumValues).nullable(),
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
  const [editingUserCard, setEditingUserCard] = useState<UserCard | null>(null);

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
      condition: userSet.set.preferredCondition ?? null,
      language: userSet.set.preferredLanguage ?? null,
      variant: userSet.set.preferredVariant ?? null,
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
      condition: data.condition ?? undefined,
      language: data.language ?? undefined,
      variant: data.variant ?? undefined,
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
                      {matchingCards.map((userCard) => {
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
                                <div className="flex items-center gap-1.5 mt-1">
                                  {userCard.language && (
                                    <Badge variant="outline" className="h-5.5">
                                      <LanguageBadge
                                        code={userCard.language}
                                        className="text-sm"
                                      />
                                    </Badge>
                                  )}
                                  {userCard.variant && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {userCard.variant}
                                    </Badge>
                                  )}
                                  {userCard.condition && (
                                    <ConditionBadge
                                      condition={userCard.condition}
                                    />
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
                                        setName:
                                          userCard.placementInfo?.setName,
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
                  </div>
                )}

                {!hasPreferences &&
                  filteredCards.map((userCard) => {
                    const isCurrentlyPlaced = userCard.id === currentUserCardId;

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
                                      setName: userCard.placementInfo?.setName,
                                    },
                                  )}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              {userCard.language && (
                                <Badge variant="outline" className="h-5.5">
                                  <LanguageBadge
                                    code={userCard.language}
                                    className="text-sm"
                                  />
                                </Badge>
                              )}
                              {userCard.variant && (
                                <Badge variant="outline" className="text-xs">
                                  {userCard.variant}
                                </Badge>
                              )}
                              {userCard.condition && (
                                <ConditionBadge
                                  condition={userCard.condition}
                                />
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

                {hasPreferences && nonMatchingCards.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
                      {intl.formatMessage({
                        id: "dialog.place_card.section.not_matching_preferences",
                        defaultMessage: "Not Matching Preferences",
                      })}
                    </h4>
                    <div className="space-y-2">
                      {nonMatchingCards.map((userCard) => {
                        const isCurrentlyPlaced =
                          userCard.id === currentUserCardId;

                        return (
                          <div
                            key={userCard.id}
                            className={cn(
                              "w-full p-3 rounded border opacity-60",
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
                                <div className="flex items-center gap-1.5 mt-1">
                                  {userCard.language && (
                                    <Badge variant="outline" className="h-5.5">
                                      <LanguageBadge
                                        code={userCard.language}
                                        className="text-sm"
                                      />
                                    </Badge>
                                  )}
                                  {userCard.variant && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {userCard.variant}
                                    </Badge>
                                  )}
                                  {userCard.condition && (
                                    <ConditionBadge
                                      condition={userCard.condition}
                                    />
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
                                        setName:
                                          userCard.placementInfo?.setName,
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

              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                <Image
                  src={card.imageSmall}
                  alt={card.name}
                  width={240}
                  height={165}
                  unoptimized
                  className="w-full sm:w-auto h-auto max-w-50 sm:max-w-60 mx-auto sm:mx-0 object-contain rounded-md"
                  draggable={false}
                  priority
                />
                <div className="flex-1 space-y-4 sm:space-y-6">
                  <h2 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-4">
                    {card.name}
                  </h2>

                  {/* Language Field */}
                  <div className="space-y-2">
                    <Label>
                      {intl.formatMessage({
                        id: "form.field.language.label",
                        defaultMessage: "Language",
                      })}
                    </Label>
                    <Controller
                      control={form.control}
                      name="language"
                      render={({ field }) => (
                        <LanguageToggleGroup
                          value={field.value ?? null}
                          onValueChange={field.onChange}
                          includeNone
                        />
                      )}
                    />
                  </div>

                  {/* Variant Field */}
                  <div className="space-y-2">
                    <Label>
                      {intl.formatMessage({
                        id: "form.field.variant.label",
                        defaultMessage: "Variant",
                      })}
                    </Label>
                    <Controller
                      control={form.control}
                      name="variant"
                      render={({ field }) => (
                        <VariantToggleGroup
                          value={field.value ?? null}
                          onValueChange={field.onChange}
                          includeNone
                        />
                      )}
                    />
                  </div>

                  {/* Condition Field */}
                  <div className="space-y-2">
                    <Label>
                      {intl.formatMessage({
                        id: "form.field.condition.label",
                        defaultMessage: "Condition",
                      })}
                    </Label>
                    <Controller
                      control={form.control}
                      name="condition"
                      render={({ field }) => (
                        <ConditionToggleGroup
                          value={field.value ?? null}
                          onValueChange={field.onChange}
                          includeNone
                        />
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4">
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
      </DialogContent>
    </Dialog>
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
          className="w-16 h-auto object-contain rounded"
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
