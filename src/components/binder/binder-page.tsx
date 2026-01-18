"use client";

import { FormattedMessage } from "react-intl";
import { PAGE_DIMENSIONS } from ".";
import CardSlot from "./card-slot";
import { BinderCard } from "./types";
import { useBinderContext } from "./binder-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { CardPicker } from "../card-browser/card-picker";

export default function BinderPage({
  cards,
  pageNumber,
  pageStartIndex,
}: {
  cards: (BinderCard | null)[];
  pageNumber: number;
  pageStartIndex: number;
}) {
  const {
    currentPosition,
    addCardsToPosition,
    closeCardPicker: closeDialog,
  } = useBinderContext();

  const handleSelectCards = (selectedCardIds: Set<string>) => {
    if (currentPosition === null) return;

    // Convert card IDs to BinderCard objects
    // TODO: You'll need to fetch the full card data based on selectedCardIds
    const cards: any[] = []; // Placeholder

    addCardsToPosition(currentPosition, cards);
  };

  return (
    <>
      <div className="bg-white border border-gray-300 shadow-sm p-4 rounded-lg">
        <h3 className="text-sm font-medium text-gray-500 mb-4">
          <FormattedMessage
            id="binder.pageNumber"
            defaultMessage="Page {number}"
            values={{ number: pageNumber }}
          />
        </h3>
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${PAGE_DIMENSIONS.columns}, minmax(0, 1fr))`,
          }}
        >
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
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
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
