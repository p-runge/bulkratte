"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppRouter } from "@/lib/api/routers/_app";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { CardBrowser } from "@/components/card-browser";
import { CardPicker } from "@/components/card-browser/card-picker";

type UserSet = Awaited<ReturnType<AppRouter["userSet"]["getById"]>>;

interface EditableBinderViewProps {
  userSet: UserSet;
  cards: Array<{ userSetCardId: string | null; cardId: string | null }>; // Array of cards with their IDs
  onCardsChange: (cards: Array<{ userSetCardId: string | null; cardId: string | null }>) => void;
}

interface EditableSlotProps {
  cardId: string | null;
  index: number;
  onRemove: () => void;
  onAdd: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragging: boolean;
  allCards: UserSet["cards"];
}

function EditableSlot({
  cardId,
  index,
  onRemove,
  onAdd,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  allCards,
}: EditableSlotProps) {
  const cardData = cardId ? allCards.find((c) => c.cardId === cardId) : null;

  if (!cardId || !cardData?.card) {
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
        src={cardData.card.imageSmall}
        alt={cardData.card.name}
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
const PAGES_VISIBLE = 2; // Show 2 pages side by side

export function EditableBinderView({ userSet, cards, onCardsChange }: EditableBinderViewProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addingAtIndex, setAddingAtIndex] = useState<number | null>(null);

  // Ensure we have enough slots to show at least 2 pages
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

  const visiblePages = pages.slice(0, PAGES_VISIBLE);

  return (
    <>
      <div className="flex gap-2 justify-center items-start">
        {visiblePages.map((page, pageIndex) => (
          <div
            key={pageIndex}
            className="bg-card border rounded-lg p-[2%] shadow-lg"
            style={{ width: "min(45vw, 500px)" }}
          >
            <div className="grid grid-cols-3 gap-2">
              {page.map((card, slotIndex) => {
                const globalIndex = pageIndex * CARDS_PER_PAGE + slotIndex;
                return (
                  <EditableSlot
                    key={globalIndex}
                    cardId={card?.cardId ?? null}
                    index={globalIndex}
                    onRemove={() => handleRemove(globalIndex)}
                    onAdd={() => handleAdd(globalIndex)}
                    onDragStart={handleDragStart(globalIndex)}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop(globalIndex)}
                    isDragging={draggedIndex === globalIndex}
                    allCards={userSet.cards}
                  />
                );
              })}
            </div>
            <div className="text-center text-sm text-muted-foreground mt-4">
              Page {pageIndex + 1}
            </div>
          </div>
        ))}
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
