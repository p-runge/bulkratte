"use client";

import { useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "../ui/button";
import { CardBrowser } from "./index";

type CardPickerProps = {
  onSelect: (selectedCardIds: Set<string>) => void;
  onClose: () => void;
  setId?: string;
  maxHeightGrid?: string;
};

export function CardPicker(props: CardPickerProps) {
  const intl = useIntl();
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());

  const handleCardClick = (cardId: string) => {
    const newSelected = new Set(selectedCards);
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId);
    } else {
      newSelected.add(cardId);
    }
    setSelectedCards(newSelected);
  };

  const handleSelectAll = (cardIds: string[]) => {
    setSelectedCards(new Set(cardIds));
  };

  const handleConfirmSelection = () => {
    props.onSelect(selectedCards);
  };

  return (
    <>
      <CardBrowser
        selectionMode="multi"
        selectedCards={selectedCards}
        onCardClick={handleCardClick}
        onSelectAll={handleSelectAll}
        setId={props.setId}
        maxHeightGrid={props.maxHeightGrid}
      />

      <div className="flex justify-end gap-2 pt-4 border-t mt-4 bg-background sticky bottom-0">
        <Button
          variant="ghost"
          onClick={props.onClose}
          className="px-4 py-2 border rounded-md hover:bg-muted"
        >
          {intl.formatMessage({
            id: "common.button.cancel",
            defaultMessage: "Cancel",
          })}
        </Button>
        <Button
          onClick={handleConfirmSelection}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          disabled={selectedCards.size === 0}
        >
          {intl.formatMessage(
            {
              id: "card.picker.button.add",
              defaultMessage:
                "Add {count, plural, one {# card} other {# cards}}",
            },
            { count: selectedCards.size },
          )}
        </Button>
      </div>
    </>
  );
}
