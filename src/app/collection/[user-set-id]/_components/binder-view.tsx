"use client";

import { AppRouter } from "@/lib/api/routers/_app";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, X, Trash2 } from "lucide-react";
import Image from "next/image";
import { FormattedMessage } from "react-intl";
import { useState } from "react";
import {
  useBinderPagination,
  CARDS_PER_PAGE,
} from "../_lib/use-binder-pagination";
import { CardPicker } from "@/components/card-browser/card-picker";
import ConfirmButton from "@/components/confirm-button";
import { MinimalCardData } from "./edit-set-content";
import { SetInfo } from "./set-info";

type UserSet = Awaited<ReturnType<AppRouter["userSet"]["getById"]>>;
type UserCard = Awaited<ReturnType<AppRouter["userCard"]["getList"]>>[number];

// Props for view-only mode
interface ViewModeProps {
  mode: "view";
  userSet: UserSet;
  userCards: UserCard[];
  onCardClick: (
    userSetCardId: string,
    cardId: string,
    hasUserCard: boolean,
    isPlaced: boolean,
    currentUserCardId: string | null,
  ) => void;
}

// Props for edit mode
interface EditModeProps {
  mode: "edit";
  cards: Array<{ userSetCardId: string | null; cardId: string | null }>;
  cardDataMap: Map<string, MinimalCardData>;
  onCardsChange: (
    cards: Array<{ userSetCardId: string | null; cardId: string | null }>,
  ) => void;
}

type BinderViewProps = ViewModeProps | EditModeProps;

// Slot component for view mode
interface ViewSlotProps {
  cardData: UserSet["cards"][number] | null;
  userCardsByCardId: Record<string, UserCard[]>;
  onCardClick: (
    userSetCardId: string,
    cardId: string,
    hasUserCard: boolean,
    isPlaced: boolean,
    currentUserCardId: string | null,
  ) => void;
}

function ViewSlot({ cardData, userCardsByCardId, onCardClick }: ViewSlotProps) {
  if (!cardData || !cardData.card) {
    return (
      <div className="aspect-245/337 bg-muted/30 rounded border-2 border-dashed border-muted-foreground/20" />
    );
  }

  const { id: userSetCardId, cardId, userCardId, card } = cardData;
  const isPlaced = !!userCardId;
  const hasUserCard = (userCardsByCardId[cardId]?.length ?? 0) > 0;

  return (
    <button
      onClick={() =>
        onCardClick(userSetCardId, cardId, hasUserCard, isPlaced, userCardId)
      }
      className={cn(
        "cursor-pointer aspect-245/337 rounded relative overflow-hidden",
        "transition-all hover:scale-105",
        hasUserCard && !isPlaced && "border-4 border-yellow-500",
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

// Slot component for edit mode
interface EditSlotProps {
  card: MinimalCardData | null;
  index: number;
  onRemove: () => void;
  onAdd: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragging: boolean;
}

function EditSlot({
  card,
  index,
  onRemove,
  onAdd,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
}: EditSlotProps) {
  if (!card) {
    return (
      <div
        className={cn(
          "aspect-[2.5/3.5] bg-muted/30 rounded border-2 border-dashed border-muted-foreground/20",
          "flex items-center justify-center group hover:border-primary/50 transition-colors",
        )}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onAdd}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "aspect-[2.5/3.5] rounded relative group cursor-move",
        isDragging && "opacity-50",
      )}
    >
      <Image
        src={card.imageSmall}
        alt={card.name}
        width={200}
        height={280}
        unoptimized
        className="w-full h-full object-contain rounded"
      />
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function BinderView(props: BinderViewProps) {
  const isEditMode = props.mode === "edit";

  // Edit mode state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addingAtIndex, setAddingAtIndex] = useState<number | null>(null);

  // Prepare data based on mode
  let orderedCards: any[];
  let userCardsByCardId: Record<string, UserCard[]> = {};

  if (isEditMode) {
    const paddedCards = [...props.cards];
    orderedCards = paddedCards;
  } else {
    // View mode: Build ordered array from userSet
    userCardsByCardId = props.userCards.reduce(
      (acc, userCard) => {
        if (!acc[userCard.cardId]) {
          acc[userCard.cardId] = [];
        }
        acc[userCard.cardId]!.push(userCard);
        return acc;
      },
      {} as Record<string, UserCard[]>,
    );

    const maxOrder = Math.max(
      ...props.userSet.cards.map((c) => c.order ?? 0),
      0,
    );
    const tempOrderedCards: ((typeof props.userSet.cards)[number] | null)[] =
      Array(maxOrder + 1).fill(null);

    props.userSet.cards.forEach((card) => {
      if (card.order !== null && card.order !== undefined) {
        tempOrderedCards[card.order] = card;
      }
    });
    orderedCards = tempOrderedCards;
  }

  // Use pagination hook
  const pagination = useBinderPagination({ totalItems: orderedCards.length });
  const {
    isMobile,
    PAGES_VISIBLE,
    buildPagesArray,
    isCoverPage,
    getDisplayPageNumber,
    getTotalPages,
    canGoNext,
    canGoPrev,
    goNext,
    goPrev,
    useKeyboardNavigation,
    getVisiblePages,
    getStartPageIndex,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    setCurrentPage,
  } = pagination;

  // Ensure minimum slots
  const minSlots = CARDS_PER_PAGE * PAGES_VISIBLE;
  while (orderedCards.length < minSlots) {
    orderedCards.push(
      isEditMode ? { userSetCardId: null, cardId: null } : null,
    );
  }

  // Build pages
  const pages = buildPagesArray(
    orderedCards,
    isEditMode ? { userSetCardId: null, cardId: null } : null,
  );
  const totalPages = getTotalPages(pages);
  const totalContentPages = Math.ceil(orderedCards.length / CARDS_PER_PAGE);

  // Keyboard navigation
  useKeyboardNavigation(totalPages);

  // Get visible pages
  const visiblePages = getVisiblePages(pages);
  const startPageIndex = getStartPageIndex();

  // Edit mode handlers
  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (targetIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();

    if (!isEditMode || draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }

    const newCards = [...orderedCards];
    const draggedCard = newCards[draggedIndex];

    newCards[draggedIndex] = newCards[targetIndex] ?? {
      userSetCardId: null,
      cardId: null,
    };
    newCards[targetIndex] = draggedCard ?? {
      userSetCardId: null,
      cardId: null,
    };

    const lastNonEmptyIndex = newCards.findLastIndex((c) => c.cardId !== null);
    const trimmed = newCards.slice(0, lastNonEmptyIndex + 1);

    props.onCardsChange(trimmed);
    setDraggedIndex(null);
  };

  const handleRemove = (index: number) => {
    if (!isEditMode) return;

    const newCards = [...orderedCards];
    newCards[index] = { userSetCardId: null, cardId: null };

    const lastNonEmptyIndex = newCards.findLastIndex((c) => c.cardId !== null);
    const trimmed = newCards.slice(0, lastNonEmptyIndex + 1);

    props.onCardsChange(trimmed);
  };

  const handleAdd = (index: number) => {
    if (!isEditMode) return;
    setAddingAtIndex(index);
    setAddDialogOpen(true);
  };

  const handleCardSelect = (selectedCardIds: Set<string>) => {
    if (!isEditMode || addingAtIndex === null) return;

    const newCards = [...orderedCards];
    const cardsToAdd = Array.from(selectedCardIds);

    let insertIndex = addingAtIndex;
    for (const cardId of cardsToAdd) {
      while (
        insertIndex < newCards.length &&
        newCards[insertIndex]?.cardId !== null
      ) {
        insertIndex++;
      }

      if (insertIndex < newCards.length) {
        newCards[insertIndex] = { userSetCardId: null, cardId };
      } else {
        newCards.push({ userSetCardId: null, cardId });
      }
      insertIndex++;
    }

    const lastNonEmptyIndex = newCards.findLastIndex((c) => c.cardId !== null);
    const trimmed = newCards.slice(0, lastNonEmptyIndex + 1);

    props.onCardsChange(trimmed);
    setAddDialogOpen(false);
    setAddingAtIndex(null);
  };

  const handleAddPage = () => {
    if (!isEditMode) return;

    const newCards = [...orderedCards];
    for (let i = 0; i < CARDS_PER_PAGE; i++) {
      newCards.push({ userSetCardId: null, cardId: null });
    }
    props.onCardsChange(newCards);

    const newPages = buildPagesArray(newCards, {
      userSetCardId: null,
      cardId: null,
    });
    const newTotalPages = getTotalPages(newPages);
    const newMaxPageGroup = pagination.getMaxPageGroup(newTotalPages);
    setCurrentPage(newMaxPageGroup);
  };

  const handleDeletePage = (pageNumber: number) => {
    if (!isEditMode) return;

    const pageStartIndex = (pageNumber - 1) * CARDS_PER_PAGE;
    const pageEndIndex = pageStartIndex + CARDS_PER_PAGE;

    const newCards = [
      ...orderedCards.slice(0, pageStartIndex),
      ...orderedCards.slice(pageEndIndex),
    ];

    const lastNonEmptyIndex = newCards.findLastIndex((c) => c.cardId !== null);
    const trimmed =
      lastNonEmptyIndex >= 0 ? newCards.slice(0, lastNonEmptyIndex + 1) : [];

    props.onCardsChange(trimmed);

    const newPaddedCards = [...trimmed];
    while (newPaddedCards.length < minSlots) {
      newPaddedCards.push({ userSetCardId: null, cardId: null });
    }
    const newPages = buildPagesArray(newPaddedCards, {
      userSetCardId: null,
      cardId: null,
    });
    const newTotalPages = getTotalPages(newPages);
    const newMaxPageGroup = pagination.getMaxPageGroup(newTotalPages);
    if (pagination.currentPage > newMaxPageGroup) {
      setCurrentPage(newMaxPageGroup);
    }
  };

  const hasEmptySlots =
    isEditMode && orderedCards.some((card) => card.cardId === null);

  return (
    <>
      {/* Set Info - only in view mode */}
      {!isEditMode && (
        <SetInfo userSet={props.userSet} userCards={props.userCards} />
      )}

      <div className="relative">
        {/* Navigation Buttons */}
        {canGoPrev() && (
          <Button
            variant="outline"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex"
            onClick={() => goPrev()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        {canGoNext(totalPages) && (
          <Button
            variant="outline"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex"
            onClick={() => goNext(totalPages)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        <div
          className="flex gap-2 justify-center"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={() => onTouchEnd(totalPages)}
        >
          {visiblePages.map((page, pageIndex) => {
            const actualPageNumber = startPageIndex + pageIndex + 1;
            const isCurrentCoverPage = isCoverPage(
              actualPageNumber,
              totalPages,
            );

            return (
              <div
                key={actualPageNumber}
                className="bg-card border rounded-lg p-[2%] shadow-lg relative"
                style={{
                  width: isMobile ? "min(90vw, 500px)" : "min(45vw, 500px)",
                }}
              >
                {/* Delete Page Button - only in edit mode on non-cover pages */}
                {isEditMode &&
                  !isCurrentCoverPage &&
                  totalContentPages > (isMobile ? 1 : PAGES_VISIBLE) && (
                    <div className="absolute -top-3 -right-3 z-10">
                      <ConfirmButton
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8 rounded-full shadow-md"
                        title="Delete Page"
                        description={`Are you sure you want to delete page ${getDisplayPageNumber(
                          actualPageNumber,
                        )}? All cards on this page will be removed.`}
                        destructive
                        onClick={() => handleDeletePage(actualPageNumber)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </ConfirmButton>
                    </div>
                  )}

                {!isCurrentCoverPage && (
                  <div className="grid grid-cols-3 gap-2">
                    {page.map((card, slotIndex) => {
                      const globalIndex =
                        (startPageIndex + pageIndex - (isMobile ? 0 : 1)) *
                          CARDS_PER_PAGE +
                        slotIndex;

                      if (isEditMode) {
                        const cardData = card?.cardId
                          ? (props.cardDataMap.get(card.cardId) ?? null)
                          : null;
                        return (
                          <EditSlot
                            key={globalIndex}
                            card={cardData}
                            index={globalIndex}
                            onRemove={() => handleRemove(globalIndex)}
                            onAdd={() => handleAdd(globalIndex)}
                            onDragStart={handleDragStart(globalIndex)}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop(globalIndex)}
                            isDragging={draggedIndex === globalIndex}
                          />
                        );
                      } else {
                        return (
                          <ViewSlot
                            key={`${actualPageNumber}-${slotIndex}`}
                            cardData={card ?? null}
                            userCardsByCardId={userCardsByCardId}
                            onCardClick={props.onCardClick}
                          />
                        );
                      }
                    })}
                  </div>
                )}

                <div className="text-center text-sm text-muted-foreground mt-4">
                  {isCurrentCoverPage ? (
                    <span className="opacity-0">Cover</span>
                  ) : isEditMode ? (
                    `Page ${getDisplayPageNumber(actualPageNumber)}`
                  ) : (
                    <FormattedMessage
                      id="binder.page.number"
                      defaultMessage="Page {pageNumber}"
                      values={{
                        pageNumber: getDisplayPageNumber(actualPageNumber),
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {/* Invisible placeholder for single page on desktop */}
          {visiblePages.length === 1 && !isMobile && (
            <div
              className="invisible"
              style={{ width: "min(45vw, 500px)" }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Page indicator on mobile */}
        <div className="flex md:hidden justify-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goPrev()}
            disabled={!canGoPrev()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground self-center">
            {pagination.currentPage + 1} /{" "}
            {pagination.getMaxPageGroup(totalPages) + 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goNext(totalPages)}
            disabled={!canGoNext(totalPages)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Add Page Button - only in edit mode */}
        {isEditMode && !hasEmptySlots && (
          <div className="flex justify-center mt-4">
            <Button variant="outline" onClick={handleAddPage} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Page
            </Button>
          </div>
        )}
      </div>

      {/* Card Picker Dialog - only in edit mode */}
      {isEditMode && (
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[95vw] max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Add Cards to Set</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto min-h-0">
              <CardPicker
                onSelect={handleCardSelect}
                onClose={() => setAddDialogOpen(false)}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
