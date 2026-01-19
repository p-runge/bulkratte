"use client";

import { FormattedMessage } from "react-intl";
import { PAGE_DIMENSIONS } from ".";
import { CardPicker } from "../card-browser/card-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { useBinderContext } from "./binder-context";
import CardSlot from "./card-slot";
import { BinderCard } from "./types";

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

  return (
    <>
      <div
        className="border border-gray-500 shadow-sm p-[2%] rounded-lg flex-1 h-full max-w-1/2"
        style={{ aspectRatio: "1", maxHeight: "100%" }}
      >
        <h3 className="text-sm font-medium text-gray-500 mb-4">
          <FormattedMessage
            id="binder.pageNumber"
            defaultMessage="Page {number}"
            values={{ number: pageNumber }}
          />
        </h3>
        <div className="grid grid-cols-3 grid-rows-3 gap-2 h-full">
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
    </>
  );
}
