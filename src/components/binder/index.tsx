import { DndContext, DragEndEvent, DragOverlay } from "@dnd-kit/core";
import { Button } from "../ui/button";
import Image from "next/image";
import React, { useState } from "react";
import { PAGE_SIZE, useBinderContext } from "./binder-context";
import BinderPage from "./binder-page";
import { BinderCard, BinderCardData } from "./types";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";

export function Binder() {
  const { cardData, pagesCount, addPage } = useBinderContext();

  // Pagination state: which double-page spread is visible
  const [currentSpread, setCurrentSpread] = useState(0);

  const orderedCards = generateOrderedCards(cardData, pagesCount * PAGE_SIZE);

  const pages = splitIntoPages(orderedCards, PAGE_SIZE);
  // Calculate the visible double-page spread
  const maxSpread = Math.max(0, Math.ceil(pages.length / 2) - 1);
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

  // Handle drag start to set overlay
  function handleDragStart(event: any) {
    const { active } = event;
    const fromPosition = active?.data?.current?.position;
    if (typeof fromPosition === "number") {
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
    if (!active || !over) return;
    const fromPosition = active.data.current?.position;
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
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="flex max-w-5xl w-full">
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
          Pages{" "}
          {currentSpread === 0
            ? 1
            : `${(currentSpread - 1) * 2 + 2}${visiblePages.length === 2 ? `-${(currentSpread - 1) * 2 + 3}` : ""}`}
          {` / ${pages.length}`}
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
