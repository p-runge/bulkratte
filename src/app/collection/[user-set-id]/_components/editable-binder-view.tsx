"use client";

import { CardPicker } from "@/components/card-browser/card-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmButton from "@/components/confirm-button";
import { cn } from "@/lib/utils";
import { Plus, X, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState, useEffect } from "react";
import { MinimalCardData } from "./edit-set-content";



interface EditableBinderViewProps {
  cards: Array<{ userSetCardId: string | null; cardId: string | null }>;
  cardDataMap: Map<string, MinimalCardData>;
  onCardsChange: (cards: Array<{ userSetCardId: string | null; cardId: string | null }>) => void;
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
          "flex items-center justify-center group hover:border-primary/50 transition-colors"
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
        isDragging && "opacity-50"
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

const CARDS_PER_PAGE = 9; // 3x3 grid

export function EditableBinderView({ cards, cardDataMap, onCardsChange }: EditableBinderViewProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addingAtIndex, setAddingAtIndex] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const PAGES_VISIBLE = isMobile ? 1 : 2;

  // Ensure we have enough slots to show at least the visible pages
  const minSlots = CARDS_PER_PAGE * PAGES_VISIBLE;
  const paddedCards = [...cards];
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
    newCards[draggedIndex] = newCards[targetIndex] ?? { userSetCardId: null, cardId: null };
    newCards[targetIndex] = draggedCard ?? { userSetCardId: null, cardId: null };

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
      while (insertIndex < newCards.length && newCards[insertIndex]?.cardId !== null) {
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

  // Split into pages
  const totalPages = Math.ceil(paddedCards.length / CARDS_PER_PAGE);
  const pages: Array<Array<{ userSetCardId: string | null; cardId: string | null }>> = [];
  for (let i = 0; i < totalPages; i++) {
    pages.push(paddedCards.slice(i * CARDS_PER_PAGE, (i + 1) * CARDS_PER_PAGE));
  }

  // Pad the last page
  if (pages.length > 0) {
    const lastPage = pages[pages.length - 1]!;
    while (lastPage.length < CARDS_PER_PAGE) {
      lastPage.push({ userSetCardId: null, cardId: null });
    }
  }

  // Navigation handlers
  const maxPageGroup = Math.max(0, Math.ceil(totalPages / PAGES_VISIBLE) - 1);
  const canGoNext = currentPage < maxPageGroup;
  const canGoPrev = currentPage > 0;

  const goNext = () => {
    if (canGoNext) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const goPrev = () => {
    if (canGoPrev) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // Arrow key support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, maxPageGroup]);

  // Swipe support
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0]!.clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0]!.clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && canGoNext) {
      goNext();
    } else if (isRightSwipe && canGoPrev) {
      goPrev();
    }
  };

  // Calculate visible pages based on current page
  const startPageIndex = currentPage * PAGES_VISIBLE;
  const visiblePages = pages.slice(startPageIndex, startPageIndex + PAGES_VISIBLE);

  // Check if all slots are filled (no empty slots)
  const hasEmptySlots = paddedCards.some(card => card.cardId === null);

  const handleAddPage = () => {
    // Add 9 new empty slots (one full page)
    const newCards = [...paddedCards];
    for (let i = 0; i < CARDS_PER_PAGE; i++) {
      newCards.push({ userSetCardId: null, cardId: null });
    }
    onCardsChange(newCards);
    // Navigate to the last page group
    const newTotalPages = Math.ceil(newCards.length / CARDS_PER_PAGE);
    const newMaxPageGroup = Math.max(0, Math.ceil(newTotalPages / PAGES_VISIBLE) - 1);
    setCurrentPage(newMaxPageGroup);
  };

  const handleDeletePage = (pageNumber: number) => {
    // Calculate the start index of the page to delete (0-indexed)
    const pageStartIndex = (pageNumber - 1) * CARDS_PER_PAGE;
    const pageEndIndex = pageStartIndex + CARDS_PER_PAGE;

    // Remove the page (9 slots)
    const newCards = [
      ...paddedCards.slice(0, pageStartIndex),
      ...paddedCards.slice(pageEndIndex)
    ];

    // Remove trailing empty slots but keep internal empty slots
    const lastNonEmptyIndex = newCards.findLastIndex((c) => c.cardId !== null);
    const trimmed = lastNonEmptyIndex >= 0 ? newCards.slice(0, lastNonEmptyIndex + 1) : [];

    onCardsChange(trimmed);

    // Adjust current page if needed
    const newTotalPages = Math.ceil(Math.max(trimmed.length, minSlots) / CARDS_PER_PAGE);
    const newMaxPageGroup = Math.max(0, Math.ceil(newTotalPages / PAGES_VISIBLE) - 1);
    if (currentPage > newMaxPageGroup) {
      setCurrentPage(newMaxPageGroup);
    }
  };

  return (
    <>
      <div className="relative">
        {/* Navigation Buttons */}
        {canGoPrev && (
          <Button
            variant="outline"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex"
            onClick={goPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        {canGoNext && (
          <Button
            variant="outline"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex"
            onClick={goNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        <div
          className="flex gap-2 justify-center items-start"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {visiblePages.map((page, pageIndex) => {
            const actualPageNumber = startPageIndex + pageIndex + 1;
            return (
              <div
                key={actualPageNumber}
                className="bg-card border rounded-lg p-[2%] shadow-lg relative"
                style={{ width: isMobile ? "min(90vw, 500px)" : "min(45vw, 500px)" }}
              >
                {/* Delete Page Button */}
                {totalPages > (isMobile ? 1 : PAGES_VISIBLE) && (
                  <div className="absolute -top-3 -right-3 z-10">
                    <ConfirmButton
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8 rounded-full shadow-md"
                      title="Delete Page"
                      description={`Are you sure you want to delete page ${actualPageNumber}? All cards on this page will be removed.`}
                      destructive
                      onClick={() => handleDeletePage(actualPageNumber)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </ConfirmButton>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {page.map((card, slotIndex) => {
                    const globalIndex = (startPageIndex + pageIndex) * CARDS_PER_PAGE + slotIndex;
                    const cardData = card?.cardId ? cardDataMap.get(card.cardId) ?? null : null;
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
                <div className="text-center text-sm text-muted-foreground mt-4">
                  Page {actualPageNumber}
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
            onClick={goPrev}
            disabled={!canGoPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground self-center">
            {currentPage + 1} / {maxPageGroup + 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={!canGoNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Add Page Button */}
        {!hasEmptySlots && (
          <div className="flex justify-center mt-4">
            <Button
              variant="outline"
              onClick={handleAddPage}
              className="gap-2"
            >
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
