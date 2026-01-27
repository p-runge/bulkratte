import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import { Button } from "../ui/button";
import Image from "next/image";
import React, { useState } from "react";
import { PAGE_SIZE, useBinderContext } from "./binder-context";
import BinderPage from "./binder-page";
import { BinderCard, BinderCardData } from "./types";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { FormattedMessage, useIntl } from "react-intl";

export function Binder() {
  const intl = useIntl();

  const { cardData, pagesCount, addPage, currentSpread, setCurrentSpread } =
    useBinderContext();

  const orderedCards = generateOrderedCards(cardData, pagesCount * PAGE_SIZE);

  const pages = splitIntoPages(orderedCards, PAGE_SIZE);
  // Calculate the visible double-page spread
  const maxSpread = Math.max(0, Math.ceil(pages.length / 2));
  let visiblePages: ((typeof pages)[number] | null)[] = [];
  if (currentSpread === 0) {
    // First spread: left is blank, right is first page
    visiblePages = [null, pages[0] ?? null];
  } else if (currentSpread === maxSpread) {
    // Last spread: left is last page, right is blank
    visiblePages = [pages[pages.length - 1] ?? null, null];
  } else {
    // Middle spreads: show two real pages
    const leftPageIdx = currentSpread * 2 - 1;
    visiblePages = [pages[leftPageIdx] ?? null, pages[leftPageIdx + 1] ?? null];
  }

  const handlePreviousPage = React.useCallback(() => {
    setCurrentSpread((s) => Math.max(0, s - 1));
  }, []);

  const handleNextPage = React.useCallback(() => {
    setCurrentSpread((s) => Math.min(maxSpread, s + 1));
  }, [maxSpread]);

  // Keyboard navigation for previous/next
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        handlePreviousPage();
      } else if (e.key === "ArrowRight") {
        handleNextPage();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [maxSpread]);

  const { form, closeCardPicker: closeDialog } = useBinderContext();

  // State for drag overlay
  const [draggingCard, setDraggingCard] = useState<BinderCard | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPosition, setDragStartPosition] = useState<number | null>(
    null,
  );

  // Handle drag start to set overlay
  function handleDragStart(event: any) {
    const { active } = event;
    setIsDragging(true);
    const fromPosition = active?.data?.current?.position;
    if (typeof fromPosition === "number") {
      setDragStartPosition(fromPosition);
      const cardData = form.getValues("cardData");
      const cardEntry = cardData.find((cd) => cd.order === fromPosition);
      if (cardEntry && cardEntry.cardId) {
        // Find the card info from cards prop
        const card = orderedCards.find((c) => c?.id === cardEntry.cardId);
        setDraggingCard(card ?? null);
      }
    }
  }

  // Handle drag end for slot move/swap
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setIsDragging(false);

    // If dropped on navigation zone, don't complete the drop
    if (over?.data?.current?.navigation) {
      // Keep the drag state but don't reset anything
      return;
    }

    if (!active || !over) {
      setDraggingCard(null);
      setDragStartPosition(null);
      return;
    }
    const fromPosition = dragStartPosition ?? active.data.current?.position;
    const toPosition = over.data.current?.position;
    if (
      typeof fromPosition !== "number" ||
      typeof toPosition !== "number" ||
      fromPosition === toPosition
    ) {
      return;
    }
    // Move or swap logic
    const cardData = form.getValues("cardData");
    const fromIndex = cardData.findIndex((cd) => cd.order === fromPosition);
    const toIndex = cardData.findIndex((cd) => cd.order === toPosition);
    if (
      fromIndex === -1 ||
      !cardData[fromIndex] ||
      !cardData[fromIndex].cardId
    ) {
      setDraggingCard(null);
      return;
    }
    if (toIndex === -1) {
      // Move card to empty slot
      const moved = { cardId: cardData[fromIndex].cardId, order: toPosition };
      const newCardData = cardData.filter((_, i) => i !== fromIndex);
      newCardData.push(moved);
      form.setValue("cardData", newCardData);
      setDraggingCard(null);
    } else if (cardData[toIndex] && cardData[toIndex].cardId) {
      // Swap cards
      const newCardData = [...cardData];
      const fromCard = newCardData[fromIndex];
      const toCard = newCardData[toIndex];
      if (!fromCard || !toCard) return;
      const tempOrder = fromCard.order;
      fromCard.order = toCard.order;
      toCard.order = tempOrder;
      form.setValue("cardData", newCardData);
      setDraggingCard(null);
    }
    setDraggingCard(null);
    setDragStartPosition(null);
  };

  const currentPagesString = (() => {
    if (currentSpread === 0) {
      return "1";
    } else if (currentSpread === maxSpread) {
      return `${pages.length}`;
    } else {
      const left = currentSpread * 2 - 1 + 1;
      const right = currentSpread * 2 - 1 + 2;
      return `${left}-${right}`;
    }
  })();

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative flex max-w-5xl w-full">
        <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
          <DragOverlay>
            {draggingCard ? (
              <div className="flex items-center justify-center">
                {draggingCard.imageSmall ? (
                  <Image
                    src={draggingCard.imageSmall}
                    alt={draggingCard.name}
                    width={245}
                    height={337}
                    className="w-full h-full object-contain rounded shadow-lg border"
                    style={{ background: "white" }}
                  />
                ) : null}
              </div>
            ) : null}
          </DragOverlay>

          <div className="flex gap-4 flex-1">
            {visiblePages.map((page, pageIndex) => {
              if (page === null) {
                return (
                  <div
                    key={pageIndex}
                    className="border border-gray-500 shadow-sm p-[2%] rounded-lg flex-1 self-stretch w-full"
                    aria-label="Blank binder page"
                  />
                );
              }

              return (
                <BinderPage
                  key={pageIndex}
                  cards={page}
                  pageNumber={(currentSpread - 1) * 2 + 2 + pageIndex}
                  pageStartIndex={
                    ((currentSpread - 1) * 2 + 1 + pageIndex) * PAGE_SIZE
                  }
                />
              );
            })}
          </div>

          <NavigationZone
            direction="left"
            disabled={currentSpread === 0}
            isDragging={isDragging}
            onNavigate={handlePreviousPage}
          />

          <NavigationZone
            direction="right"
            disabled={currentSpread === maxSpread}
            isDragging={isDragging}
            onNavigate={handleNextPage}
          />
        </DndContext>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mt-2">
        <Button
          onClick={handlePreviousPage}
          disabled={currentSpread === 0}
          variant="outline"
          aria-label="Previous pages"
        >
          <ArrowLeft />
        </Button>
        <span className="text-sm">
          <FormattedMessage
            id="binder.pagination"
            defaultMessage="{singlePage, select, true {Page {currentPages}} other {Pages {currentPages}}} of {totalPages}"
            values={{
              currentPages: currentPagesString,
              singlePage: currentPagesString.includes("-") ? false : true,
              totalPages: pages.length,
            }}
          />
        </span>
        <Button
          onClick={handleNextPage}
          disabled={currentSpread === maxSpread}
          variant="outline"
          aria-label="Next pages"
        >
          <ArrowRight />
        </Button>
      </div>
      <Button onClick={addPage}>
        <Plus /> Add Page
      </Button>
    </div>
  );
}

function generateOrderedCards(
  cardData: BinderCardData[],
  cardCount: number,
): (BinderCard | null | undefined)[] {
  const orderedCards: (BinderCard | null | undefined)[] = new Array(
    cardCount,
  ).fill(null);

  cardData.forEach(({ card, order }) => {
    orderedCards[order] = card;
  });

  return orderedCards;
}

function splitIntoPages<T>(items: T[], pageSize: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += pageSize) {
    pages.push(items.slice(i, i + pageSize));
  }
  return pages;
}

function NavigationZone({
  direction,
  disabled,
  isDragging,
  onNavigate,
}: {
  direction: "left" | "right";
  disabled: boolean;
  isDragging: boolean;
  onNavigate: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `navigation-zone-${direction}`,
    data: { navigation: direction },
    disabled,
  });

  // Auto-navigate when hovering over the zone while dragging
  React.useEffect(() => {
    if (isOver && !disabled) {
      const timeout = setTimeout(() => {
        onNavigate();
      }, 500); // Half second delay before navigating
      return () => clearTimeout(timeout);
    }
  }, [isOver, disabled, onNavigate]);

  const showZone = isDragging && !disabled;

  return (
    <div
      ref={setNodeRef}
      className={`
        absolute ${direction === "left" ? "right-full" : "left-full"} top-0 bottom-0
        w-20 transition-opacity duration-300 ease-in-out
        ${showZone ? "opacity-100" : "opacity-0 pointer-events-none"}
        ${isOver ? "bg-primary/20" : "bg-primary/10"}
        border-2 border-dashed
        ${isOver ? "border-primary" : "border-primary/30"}
        rounded-lg
        flex items-center justify-center
        ${disabled ? "cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      {showZone && (
        <div className="flex flex-col items-center justify-center gap-2 text-primary">
          {direction === "left" ? (
            <ArrowLeft className="h-8 w-8" />
          ) : (
            <ArrowRight className="h-8 w-8" />
          )}
          <span className="text-xs font-medium whitespace-nowrap">
            {direction === "left" ? "Previous" : "Next"}
          </span>
        </div>
      )}
    </div>
  );
}
