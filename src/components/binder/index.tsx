import { DndContext, DragEndEvent, DragOverlay } from "@dnd-kit/core";
import Image from "next/image";
import { useState } from "react";
import { useBinderContext } from "./binder-context";
import BinderPage from "./binder-page";
import { BinderCard, BinderCardData } from "./types";

export const PAGE_DIMENSIONS = { columns: 3, rows: 3 };
const PAGE_SIZE = PAGE_DIMENSIONS.columns * PAGE_DIMENSIONS.rows;

export function Binder() {
  const { cardData } = useBinderContext();
  const orderedCards = generateOrderedCards(cardData);

  // ensure the amount of cards is a multiple of PAGE_SIZE * 2, and is at least PAGE_SIZE * 2
  const amountOfCards = Math.max(
    PAGE_SIZE * 2,
    Math.ceil(orderedCards.length / (PAGE_SIZE * 2)) * (PAGE_SIZE * 2),
  );
  while (orderedCards.length < amountOfCards) {
    orderedCards.push(null);
  }

  const pages = splitIntoPages(orderedCards, PAGE_SIZE);

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
    <div className="flex justify-center">
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

          {pages.map((pageCards, pageIndex) => (
            <BinderPage
              key={pageIndex}
              cards={pageCards}
              pageNumber={pageIndex + 1}
              pageStartIndex={pageIndex * PAGE_SIZE}
            />
          ))}
        </DndContext>
      </div>
    </div>
  );
}

function generateOrderedCards(
  cardData: BinderCardData[],
): (BinderCard | null | undefined)[] {
  if (cardData.length === 0) return [];

  const maxOrder = Math.max(...cardData.map((cd) => cd.order));
  const orderedCards: (BinderCard | null | undefined)[] = new Array(
    maxOrder + 1,
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
