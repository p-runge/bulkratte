"use client";

import { FormattedMessage } from "react-intl";
import { CardPicker } from "../card-browser/card-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { BINDER_LAYOUT_CONFIGS, useBinderContext } from "./binder-context";
import { CardSlot } from "./card-slot";
import { BinderCard, BinderCardData, UserSet } from "./types";
import type { BinderLayout } from "@/lib/db/enums";

const GRID_CLASSES: Record<BinderLayout, string> = {
  "3x3": "grid-cols-3 grid-rows-3",
  "4x3": "grid-cols-4 grid-rows-3",
  "2x2": "grid-cols-2 grid-rows-2",
};

export default function BinderPage({
  cards,
  pageStartIndex,
}: {
  cards: (BinderCard | null | undefined)[];
  pageStartIndex: number;
}) {
  const {
    form,
    currentPosition,
    closeCardPicker: closeDialog,
    pageDimensions,
  } = useBinderContext();

  const binderLayout = (form.watch("binderLayout") ?? "3x3") as BinderLayout;
  const gridClass = GRID_CLASSES[binderLayout];

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
      <div className="border border-gray-500 shadow-sm p-[2%] rounded-lg flex-1 self-stretch w-full">
        <div className={`grid ${gridClass} gap-2 flex-1`}>
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
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              <FormattedMessage
                id="binder.addCards.title"
                defaultMessage="Add Cards"
              />
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[80vh]">
            <CardPicker onSelect={handleSelectCards} onClose={closeDialog} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
