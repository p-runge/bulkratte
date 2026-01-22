"use client";

import { FormattedMessage } from "react-intl";
import { PAGE_DIMENSIONS } from ".";
import { CardPicker } from "../card-browser/card-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { useBinderContext } from "./binder-context";
import { CardSlot } from "./card-slot";
import { BinderCard } from "./types";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  useDndMonitor,
} from "@dnd-kit/core";
import { useState } from "react";
import Image from "next/image";

export default function BinderPage({
  cards,
  pageNumber,
  pageStartIndex,
}: {
  cards: (BinderCard | null | undefined)[];
  pageNumber: number;
  pageStartIndex: number;
}) {
  const {
    form,
    currentPosition,
    closeCardPicker: closeDialog,
  } = useBinderContext();

  const handleSelectCards = (selectedCardIds: Set<string>) => {
    if (currentPosition === null) return;

    const oldCardData = form.getValues("cardData");

    // add selectedCardIds at currentPosition while skipping reserved order positions
    const newCardData = [...oldCardData];
    let insertPosition = currentPosition;
    selectedCardIds.forEach((cardId) => {
      while (newCardData.some((cd) => cd.order === insertPosition)) {
        insertPosition++;
      }
      newCardData.splice(insertPosition, 0, {
        cardId,
        order: insertPosition,
      });
      insertPosition++;
    });

    form.setValue("cardData", newCardData);
    closeDialog();
  };

  // State for drag overlay
  const [activeCard, setActiveCard] = useState<BinderCard | null>(null);

  // Handle drag start to set overlay
  function handleDragStart(event: any) {
    const { active } = event;
    const fromPosition = active?.data?.current?.position;
    if (typeof fromPosition === "number") {
      const cardData = form.getValues("cardData");
      const cardEntry = cardData.find((cd) => cd.order === fromPosition);
      if (cardEntry && cardEntry.cardId) {
        // Find the card info from cards prop
        const card = cards[fromPosition - pageStartIndex] || null;
        setActiveCard(card ?? null);
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
      setActiveCard(null);
      return;
    }
    if (toIndex === -1) {
      // Move card to empty slot
      const moved = { cardId: cardData[fromIndex].cardId, order: toPosition };
      const newCardData = cardData.filter((_, i) => i !== fromIndex);
      newCardData.push(moved);
      form.setValue("cardData", newCardData);
      setActiveCard(null);
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
      setActiveCard(null);
    }
    setActiveCard(null);
  };

  return (
    <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
      <div className="border border-gray-500 shadow-sm p-[2%] rounded-lg flex-1 self-stretch w-full">
        <h3 className="text-sm font-medium text-gray-500 mb-4">
          <FormattedMessage
            id="binder.pageNumber"
            defaultMessage="Page {number}"
            values={{ number: pageNumber }}
          />
        </h3>
        <div className="grid grid-cols-3 grid-rows-3 gap-2 flex-1">
          {cards.map((card, index) => (
            <CardSlot
              key={index}
              card={card}
              position={pageStartIndex + index}
            />
          ))}
        </div>
      </div>

      <Dialog open={currentPosition !== null} onOpenChange={closeDialog}>
        {/* Drag overlay for card image */}
        <DragOverlay>
          {activeCard ? (
            <div className="flex items-center justify-center">
              {activeCard.imageSmall ? (
                <Image
                  src={activeCard.imageSmall}
                  alt={activeCard.name}
                  width={245}
                  height={337}
                  className="w-full h-full object-contain rounded shadow-lg border"
                  style={{ background: "white" }}
                />
              ) : null}
            </div>
          ) : null}
        </DragOverlay>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              <FormattedMessage
                id="binder.addCards.title"
                defaultMessage="Add Cards"
              />
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <CardPicker
              onSelect={handleSelectCards}
              onClose={closeDialog}
              maxHeightGrid="60vh"
            />
          </div>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}
