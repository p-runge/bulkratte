"use client";

import { CardPicker } from "@/components/card-browser/card-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ConfirmButton from "@/components/confirm-button";
import { cn } from "@/lib/utils";
import { Plus, X, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { MinimalCardData } from "./edit-set-content";
import {
  useBinderPagination,
  CARDS_PER_PAGE,
} from "../_lib/use-binder-pagination";

interface EditableBinderViewProps {
  cards: Array<{ userSetCardId: string | null; cardId: string | null }>;
  cardDataMap: Map<string, MinimalCardData>;
  onCardsChange: (
    cards: Array<{ userSetCardId: string | null; cardId: string | null }>,
  ) => void;
}

interface EditableSlotProps {
  card: MinimalCardData | null;
  index: number;
  onRemove: () => void;
  onAdd: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragging: boolean;
}

function EditableSlot({
  card,
  index,
  onRemove,
  onAdd,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
}: EditableSlotProps) {
  if (!card) {
    // Empty slot
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

export function EditableBinderView({
  cards,
  cardDataMap,
  onCardsChange,
}: EditableBinderViewProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addingAtIndex, setAddingAtIndex] = useState<number | null>(null);

  // Ensure we have enough slots to show at least the visible pages initially
  const paddedCards = [...cards];

  // Use binder pagination hook
  const pagination = useBinderPagination({ totalItems: paddedCards.length });
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

  const minSlots = CARDS_PER_PAGE * PAGES_VISIBLE;
  while (paddedCards.length < minSlots) {
    paddedCards.push({ userSetCardId: null, cardId: null });
  }

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

    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }

    const newCards = [...paddedCards];
    const draggedCard = newCards[draggedIndex];

    // Swap the cards (swaps both userSetCardId and cardId)
    newCards[draggedIndex] = newCards[targetIndex] ?? {
      userSetCardId: null,
      cardId: null,
    };
    newCards[targetIndex] = draggedCard ?? {
      userSetCardId: null,
      cardId: null,
    };

    // Remove trailing empty slots but keep internal empty slots
    const lastNonEmptyIndex = newCards.findLastIndex((c) => c.cardId !== null);
    const trimmed = newCards.slice(0, lastNonEmptyIndex + 1);

    onCardsChange(trimmed);
    setDraggedIndex(null);
  };

  const handleRemove = (index: number) => {
    const newCards = [...paddedCards];
    newCards[index] = { userSetCardId: null, cardId: null };

    // Remove trailing empty slots but keep internal empty slots
    const lastNonEmptyIndex = newCards.findLastIndex((c) => c.cardId !== null);
    const trimmed = newCards.slice(0, lastNonEmptyIndex + 1);

    onCardsChange(trimmed);
  };

  const handleAdd = (index: number) => {
    setAddingAtIndex(index);
    setAddDialogOpen(true);
  };

  const handleCardSelect = (selectedCardIds: Set<string>) => {
    if (addingAtIndex === null) return;

    const newCards = [...paddedCards];
    const cardsToAdd = Array.from(selectedCardIds);

    // Insert cards starting at the target index
    let insertIndex = addingAtIndex;
    for (const cardId of cardsToAdd) {
      // Find next available slot or add at end
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

    // Remove trailing empty slots but keep internal empty slots
    const lastNonEmptyIndex = newCards.findLastIndex((c) => c.cardId !== null);
    const trimmed = newCards.slice(0, lastNonEmptyIndex + 1);

    onCardsChange(trimmed);
    setAddDialogOpen(false);
    setAddingAtIndex(null);
  };

  // Build pages with cover pages
  const pages = buildPagesArray(paddedCards, {
    userSetCardId: null,
    cardId: null,
  });
  const totalPages = getTotalPages(pages);
  const totalContentPages = Math.ceil(paddedCards.length / CARDS_PER_PAGE);

  // Set up keyboard navigation
  useKeyboardNavigation(totalPages);

  // Get visible pages
  const visiblePages = getVisiblePages(pages);
  const startPageIndex = getStartPageIndex();

  // Check if all slots are filled (no empty slots)
  const hasEmptySlots = paddedCards.some((card) => card.cardId === null);

  const handleAddPage = () => {
    // Add 9 new empty slots (one full page)
    const newCards = [...paddedCards];
    for (let i = 0; i < CARDS_PER_PAGE; i++) {
      newCards.push({ userSetCardId: null, cardId: null });
    }
    onCardsChange(newCards);
    // Navigate to the last page group
    const newTotalContentPages = Math.ceil(newCards.length / CARDS_PER_PAGE);
    const newPages = buildPagesArray(newCards, {
      userSetCardId: null,
      cardId: null,
    });
    const newTotalPages = getTotalPages(newPages);
    const newMaxPageGroup = pagination.getMaxPageGroup(newTotalPages);
    setCurrentPage(newMaxPageGroup);
  };

  const handleDeletePage = (pageNumber: number) => {
    // Calculate the start index of the page to delete (0-indexed)
    const pageStartIndex = (pageNumber - 1) * CARDS_PER_PAGE;
    const pageEndIndex = pageStartIndex + CARDS_PER_PAGE;

    // Remove the page (9 slots)
    const newCards = [
      ...paddedCards.slice(0, pageStartIndex),
      ...paddedCards.slice(pageEndIndex),
    ];

    // Remove trailing empty slots but keep internal empty slots
    const lastNonEmptyIndex = newCards.findLastIndex((c) => c.cardId !== null);
    const trimmed =
      lastNonEmptyIndex >= 0 ? newCards.slice(0, lastNonEmptyIndex + 1) : [];

    onCardsChange(trimmed);

    // Adjust current page if needed
    const newPaddedCards = [...trimmed];
    const newMinSlots = CARDS_PER_PAGE * PAGES_VISIBLE;
    while (newPaddedCards.length < newMinSlots) {
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

  return (
    <>
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
          className="flex gap-2 justify-center items-start"
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
                {/* Delete Page Button - only show on non-cover pages */}
                {!isCurrentCoverPage &&
                  totalContentPages > (isMobile ? 1 : PAGES_VISIBLE) && (
                    <div className="absolute -top-3 -right-3 z-10">
                      <ConfirmButton
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8 rounded-full shadow-md"
                        title="Delete Page"
                        description={`Are you sure you want to delete page ${getDisplayPageNumber(actualPageNumber)}? All cards on this page will be removed.`}
                        destructive
                        onClick={() => handleDeletePage(actualPageNumber)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </ConfirmButton>
                    </div>
                  )}
                {isCurrentCoverPage ? (
                  // Empty cover page - invisible grid to match height
                  <div className="grid grid-cols-3 gap-2">
                    <div className="aspect-[2.5/3.5] invisible col-span-3" />
                    <div className="aspect-[2.5/3.5] invisible col-span-3" />
                    <div className="aspect-[2.5/3.5] invisible col-span-3" />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {page.map((card, slotIndex) => {
                      const globalIndex =
                        (startPageIndex + pageIndex) * CARDS_PER_PAGE +
                        slotIndex;
                      const cardData = card?.cardId
                        ? (cardDataMap.get(card.cardId) ?? null)
                        : null;
                      return (
                        <EditableSlot
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
                    })}
                  </div>
                )}
                <div className="text-center text-sm text-muted-foreground mt-4">
                  {isCurrentCoverPage ? (
                    <span className="opacity-0">Cover</span>
                  ) : (
                    `Page ${getDisplayPageNumber(actualPageNumber)}`
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

        {/* Add Page Button */}
        {!hasEmptySlots && (
          <div className="flex justify-center mt-4">
            <Button variant="outline" onClick={handleAddPage} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Page
            </Button>
          </div>
        )}
      </div>

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
    </>
  );
}
