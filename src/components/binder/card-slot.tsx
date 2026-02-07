import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import Image from "next/image";
import { Button } from "../ui/button";
import { useBinderContext } from "./binder-context";
import { BinderCard } from "./types";
import React, { useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";

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
  } = useBinderContext();
  const [showRemove, setShowRemove] = useState(false);

  // DnD Kit hooks - disable dragging in remove mode
  const {
    setNodeRef: setDraggableRef,
    attributes,
    listeners,
    isDragging,
  } = useDraggable({
    id: `binder-slot-${position}`,
    data: { position },
    disabled: !card || interactionMode === "remove" || mode === "place",
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
    const preferredLanguage = form?.watch("preferredLanguage");
    const preferredVariant = form?.watch("preferredVariant");
    const preferredCondition = form?.watch("preferredCondition");

    const matchingUserCards =
      userCards?.filter((uc: any) => {
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

        // Check preferred condition if toggle is on
        if (considerPreferredCondition && preferredCondition) {
          if (uc.condition !== preferredCondition) return false;
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

    // Determine border color based on card availability
    let borderColor = "";
    if (hasUserCard && !isPlaced) {
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
      </button>
    );
  }

  // In remove mode, the card renders as a remove button and is fully clickable
  if (interactionMode === "remove") {
    return (
      <div
        onClick={handleRemoveClick}
        className={cn(
          "w-full h-full aspect-245/337 border border-gray-400 rounded flex items-center justify-center text-xs font-medium relative overflow-hidden",
          "cursor-pointer",
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
        {/* Remove button in top-right corner, always visible */}
        <div className="absolute inset-0 flex justify-center items-center">
          <Button
            variant="destructive"
            size="icon"
            className={cn("h-7 w-7 rounded-lg")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
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
      {...listeners}
      className={cn(
        "group w-full h-full aspect-245/337 border border-gray-400 rounded flex items-center justify-center text-xs font-medium relative overflow-hidden",
        isDragging && "opacity-50",
        isOver && "ring-2 ring-primary",
      )}
      onMouseEnter={() => setShowRemove(true)}
      onMouseLeave={() => setShowRemove(false)}
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

      {showRemove && (
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
