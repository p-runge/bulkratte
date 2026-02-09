import pokemonAPI from "@/lib/pokemon-api";
import { cn } from "@/lib/utils";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Plus, Settings, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { ConditionBadge } from "../condition-badge";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { useBinderContext } from "./binder-context";
import { CardPreferencesDialog } from "./card-preferences-dialog";
import { BinderCard } from "./types";

export function CardSlot({
  card,
  position,
}: {
  card: BinderCard | null | undefined;
  position: number;
}) {
  const {
    removeCardAtPosition,
    interactionMode,
    mode,
    userCards,
    placedUserCards,
    onCardClick,
    initialUserSet,
    userSetId,
    form,
    considerPreferredLanguage = false,
    considerPreferredVariant = false,
    considerPreferredCondition = false,
    showCardPreferences = false,
  } = useBinderContext();
  const [showRemove, setShowRemove] = useState(false);
  const [showPreferencesDialog, setShowPreferencesDialog] = useState(false);

  // DnD Kit hooks - disable dragging in remove mode
  const {
    setNodeRef: setDraggableRef,
    attributes,
    listeners,
    isDragging,
  } = useDraggable({
    id: `binder-slot-${position}`,
    data: { position },
    disabled: !card || interactionMode === "modify" || mode === "place",
  });
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `binder-slot-${position}`,
    data: { position },
  });

  // DnD Kit context will be provided by parent (BinderPage)

  if (card === null) {
    return (
      <EmptyCardSlot
        position={position}
        setDroppableRef={setDroppableRef}
        isOver={isOver}
      />
    );
  }

  const handleRemoveClick = () => {
    removeCardAtPosition(position);
  };

  // Check if this card has card-level preferences (different from set-level defaults)
  const cardData = form?.watch("cardData");
  const currentCardData = cardData?.find((c) => c.order === position);
  const setLevelLanguage = form?.watch("preferredLanguage");
  const setLevelVariant = form?.watch("preferredVariant");
  const setLevelCondition = form?.watch("preferredCondition");

  const hasCardLevelPreferences =
    (currentCardData?.preferredLanguage !== undefined &&
      currentCardData?.preferredLanguage !== null &&
      currentCardData?.preferredLanguage !== setLevelLanguage) ||
    (currentCardData?.preferredVariant !== undefined &&
      currentCardData?.preferredVariant !== null &&
      currentCardData?.preferredVariant !== setLevelVariant) ||
    (currentCardData?.preferredCondition !== undefined &&
      currentCardData?.preferredCondition !== null &&
      currentCardData?.preferredCondition !== setLevelCondition);

  // Place mode - different rendering for view-only with user card status
  if (mode === "place") {
    if (!card) {
      return (
        <div className="aspect-245/337 bg-muted/30 rounded border-2 border-dashed border-muted-foreground/20" />
      );
    }

    // Find the original card data at this position from initialUserSet
    const originalCard = initialUserSet.cards.find((c) => c.order === position);
    const userSetCardId = originalCard?.id || "";
    const cardId = card.id;
    const isPlaced = !!originalCard?.userCardId;
    const currentUserCardId = originalCard?.userCardId || null;

    // Check if user has this card in their collection
    // If we're in place mode with toggles, we need to match against preferred properties
    // Use card-level preferences if available, otherwise fall back to set-level preferences
    const setLevelLanguage = form?.watch("preferredLanguage");
    const setLevelVariant = form?.watch("preferredVariant");
    const setLevelCondition = form?.watch("preferredCondition");

    const preferredLanguage =
      originalCard?.preferredLanguage ?? setLevelLanguage;
    const preferredVariant = originalCard?.preferredVariant ?? setLevelVariant;
    const preferredCondition =
      originalCard?.preferredCondition ?? setLevelCondition;

    const matchingUserCards =
      userCards?.filter((uc) => {
        // Must match card ID
        if (uc.card.id !== cardId) return false;

        // Check preferred language if toggle is on
        if (considerPreferredLanguage && preferredLanguage) {
          if (uc.language !== preferredLanguage) return false;
        }

        // Check preferred variant if toggle is on
        if (considerPreferredVariant && preferredVariant) {
          if (uc.variant !== preferredVariant) return false;
        }

        // Check preferred condition if toggle is on (as minimum condition)
        if (considerPreferredCondition && preferredCondition) {
          if (
            !pokemonAPI.meetsMinimumCondition(uc.condition, preferredCondition)
          ) {
            return false;
          }
        }

        return true;
      }) ?? [];

    const hasUserCard = matchingUserCards.length > 0;

    const handleClick = () => {
      if (onCardClick && cardId && userSetCardId) {
        onCardClick(
          userSetCardId,
          cardId,
          hasUserCard,
          isPlaced,
          currentUserCardId,
        );
      }
    };

    // Determine border color based on card availability and preference matching
    let borderColor = "";

    // Check if the placed card matches preferences (red border if it doesn't)
    if (isPlaced && currentUserCardId) {
      const placedUserCard = userCards?.find(
        (uc) => uc.id === currentUserCardId,
      );

      if (placedUserCard) {
        let matchesPreferences = true;

        // Check preferred language if toggle is on
        if (considerPreferredLanguage && preferredLanguage) {
          if (placedUserCard.language !== preferredLanguage) {
            matchesPreferences = false;
          }
        }

        // Check preferred variant if toggle is on
        if (considerPreferredVariant && preferredVariant) {
          if (placedUserCard.variant !== preferredVariant) {
            matchesPreferences = false;
          }
        }

        // Check preferred condition if toggle is on (as minimum condition)
        if (considerPreferredCondition && preferredCondition) {
          if (
            !pokemonAPI.meetsMinimumCondition(
              placedUserCard.condition,
              preferredCondition,
            )
          ) {
            matchesPreferences = false;
          }
        }

        if (!matchesPreferences) {
          borderColor = "border-4 border-red-500";
        }
      }
    } else if (hasUserCard && !isPlaced) {
      // User has the card but it's not placed here
      // Check if ALL user's cards of this type are in other sets

      if (placedUserCards && matchingUserCards.length > 0) {
        // Create a map of user card IDs placed in other sets
        const placedInOtherSets = new Set(
          placedUserCards
            .filter((pc) => pc.userSetId !== userSetId)
            .map((pc) => pc.userCardId),
        );

        // Check if ALL matching user cards are placed in other sets
        const allCardsInOtherSets = matchingUserCards.every((uc: any) =>
          placedInOtherSets.has(uc.id),
        );

        if (allCardsInOtherSets) {
          borderColor = "border-4 border-orange-500";
        } else {
          borderColor = "border-4 border-yellow-500";
        }
      } else {
        // Default to yellow if we don't have placement data
        borderColor = "border-4 border-yellow-500";
      }
    }

    return (
      <button
        onClick={handleClick}
        className={cn(
          "cursor-pointer aspect-245/337 rounded relative overflow-hidden",
          "transition-all hover:scale-105",
          borderColor,
        )}
      >
        <div
          className={cn(
            "focus:outline-none focus:ring-4 focus:ring-ring focus:ring-offset-2",
            !isPlaced && "opacity-40 grayscale",
            hasUserCard && !isPlaced && "-m-1",
            borderColor && "-m-1",
          )}
        >
          <Image
            src={card.imageSmall}
            alt={card.name}
            width={245}
            height={337}
            unoptimized
            className="w-full h-full object-contain rounded"
          />
        </div>
        {/* Show detailed preferences when toggle is enabled */}
        {showCardPreferences && hasCardLevelPreferences && (
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end pointer-events-none">
            {currentCardData?.preferredLanguage &&
              currentCardData.preferredLanguage !== setLevelLanguage && (
                <Badge className="text-lg bg-black/70 text-white border-none px-1.5 py-0.5">
                  {
                    pokemonAPI.cardLanguages.find(
                      (l) => l.code === currentCardData.preferredLanguage,
                    )?.flag
                  }
                </Badge>
              )}
            {currentCardData?.preferredVariant &&
              currentCardData.preferredVariant !== setLevelVariant && (
                <Badge className="text-xs bg-black/70 text-white border-none">
                  {currentCardData.preferredVariant}
                </Badge>
              )}
            {currentCardData?.preferredCondition &&
              currentCardData.preferredCondition !== setLevelCondition && (
                <ConditionBadge
                  condition={currentCardData.preferredCondition}
                />
              )}
          </div>
        )}
      </button>
    );
  }

  // In modify mode, show both remove and settings buttons
  if (interactionMode === "modify") {
    return (
      <>
        <div
          className={cn(
            "w-full h-full aspect-245/337 border border-gray-400 rounded flex items-center justify-center text-xs font-medium relative overflow-hidden",
          )}
        >
          {card ? (
            <Image
              src={card.imageSmall}
              alt={card.name}
              width={245}
              height={337}
              unoptimized
              className="w-full h-full object-contain rounded"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 animate-pulse rounded" />
          )}
          {/* Action buttons, always visible, arranged vertically */}
          <div className="absolute inset-0 flex flex-col justify-center items-center gap-2 pointer-events-none">
            <Button
              variant="secondary"
              size="icon"
              className={cn(
                "h-8 w-8 rounded-lg shadow-lg bg-background/70 text-foreground pointer-events-auto",
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowPreferencesDialog(true);
              }}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              className={cn("h-8 w-8 rounded-lg shadow-lg pointer-events-auto")}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleRemoveClick();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showPreferencesDialog && card && (
          <CardPreferencesDialog
            card={card}
            position={position}
            currentPreferences={{
              preferredLanguage:
                form?.watch("cardData").find((c) => c.order === position)
                  ?.preferredLanguage ?? null,
              preferredVariant:
                form?.watch("cardData").find((c) => c.order === position)
                  ?.preferredVariant ?? null,
              preferredCondition:
                form?.watch("cardData").find((c) => c.order === position)
                  ?.preferredCondition ?? null,
            }}
            setLevelPreferences={{
              preferredLanguage: form?.watch("preferredLanguage"),
              preferredVariant: form?.watch("preferredVariant"),
              preferredCondition: form?.watch("preferredCondition"),
            }}
            onSave={(preferences) => {
              const cardData = form?.getValues("cardData") || [];
              const cardIndex = cardData.findIndex((c) => c.order === position);
              if (cardIndex !== -1) {
                const updatedCardData = [...cardData];
                updatedCardData[cardIndex] = {
                  ...updatedCardData[cardIndex]!,
                  preferredLanguage: preferences.preferredLanguage as any,
                  preferredVariant: preferences.preferredVariant as any,
                  preferredCondition: preferences.preferredCondition as any,
                };
                form?.setValue("cardData", updatedCardData);
              }
            }}
            onClose={() => setShowPreferencesDialog(false)}
          />
        )}
      </>
    );
  }

  // In browse mode, show remove button on hover (desktop only)
  return (
    <div
      ref={(node) => {
        setDraggableRef(node);
        setDroppableRef(node);
      }}
      {...attributes}
      className={cn(
        "group w-full h-full aspect-245/337 border border-gray-400 rounded flex items-center justify-center text-xs font-medium relative overflow-hidden",
        isDragging && "opacity-50",
        isOver && "ring-2 ring-primary",
      )}
      onMouseEnter={() => setShowRemove(true)}
      onMouseLeave={() => setShowRemove(false)}
    >
      {card ? (
        <div {...listeners} className="w-full h-full">
          <Image
            src={card.imageSmall}
            alt={card.name}
            width={245}
            height={337}
            unoptimized
            className="w-full h-full object-contain rounded"
          />
        </div>
      ) : (
        <div className="w-full h-full bg-gray-200 animate-pulse rounded" />
      )}

      {/* Card-level preferences indicator */}
      {hasCardLevelPreferences && (
        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10 pointer-events-none flex flex-col gap-1 items-center">
          {currentCardData?.preferredLanguage &&
            currentCardData.preferredLanguage !== setLevelLanguage && (
              <Badge className="text-lg bg-black/70 text-white border-none px-1.5 py-0.5">
                {
                  pokemonAPI.cardLanguages.find(
                    (l) => l.code === currentCardData.preferredLanguage,
                  )?.flag
                }
              </Badge>
            )}
          {currentCardData?.preferredVariant &&
            currentCardData.preferredVariant !== setLevelVariant && (
              <Badge className="text-xs bg-black/70 text-white border-none">
                {currentCardData.preferredVariant}
              </Badge>
            )}
          {currentCardData?.preferredCondition &&
            currentCardData.preferredCondition !== setLevelCondition && (
              <ConditionBadge condition={currentCardData.preferredCondition} />
            )}
        </div>
      )}

      {showRemove && (
        <>
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-1 left-1 h-7 w-7 z-10 shadow-lg"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowPreferencesDialog(true);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-7 w-7 z-10 shadow-lg"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleRemoveClick();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      )}

      {showPreferencesDialog && card && (
        <CardPreferencesDialog
          card={card}
          position={position}
          currentPreferences={{
            preferredLanguage:
              form?.watch("cardData").find((c) => c.order === position)
                ?.preferredLanguage ?? null,
            preferredVariant:
              form?.watch("cardData").find((c) => c.order === position)
                ?.preferredVariant ?? null,
            preferredCondition:
              form?.watch("cardData").find((c) => c.order === position)
                ?.preferredCondition ?? null,
          }}
          setLevelPreferences={{
            preferredLanguage: form?.watch("preferredLanguage"),
            preferredVariant: form?.watch("preferredVariant"),
            preferredCondition: form?.watch("preferredCondition"),
          }}
          onSave={(preferences) => {
            const cardData = form?.getValues("cardData") || [];
            const cardIndex = cardData.findIndex((c) => c.order === position);
            if (cardIndex !== -1) {
              const updatedCardData = [...cardData];
              updatedCardData[cardIndex] = {
                ...updatedCardData[cardIndex]!,
                preferredLanguage: preferences.preferredLanguage as any,
                preferredVariant: preferences.preferredVariant as any,
                preferredCondition: preferences.preferredCondition as any,
              };
              form?.setValue("cardData", updatedCardData);
            }
          }}
          onClose={() => setShowPreferencesDialog(false)}
        />
      )}
    </div>
  );
}

function EmptyCardSlot({
  position,
  setDroppableRef,
  isOver,
}: {
  position: number;
  setDroppableRef: (node: HTMLElement | null) => void;
  isOver: boolean;
}) {
  const { pickCardsForPosition, mode } = useBinderContext();

  // In place mode, empty slots are just visual - not interactive
  if (mode === "place") {
    return (
      <div className="aspect-245/337 bg-muted/30 rounded border-2 border-dashed border-muted-foreground/20" />
    );
  }

  const onAdd = () => {
    pickCardsForPosition(position);
  };

  return (
    <Button
      ref={setDroppableRef}
      variant="link"
      onClick={onAdd}
      className={cn(
        "group w-full h-full aspect-245/337 p-0",
        "bg-muted/30 rounded border-2 border-dashed border-muted-foreground/20",
        "hover:border-primary/50 transition-colors",
        isOver && "ring-2 ring-primary",
      )}
    >
      <Plus className="h-6 w-6 opacity-20 group-hover:opacity-100 transition-opacity" />
    </Button>
  );
}
