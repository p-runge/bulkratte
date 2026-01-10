"use client";

import type { Card } from "@/lib/db";
import { cn } from "@/lib/utils";
import { Check, Circle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import Image from "next/image";
import { FormattedMessage, useIntl } from "react-intl";

export type CardWithGridId = Card & { price: number | undefined } & { gridId: string };

type CardGridProps = {
  cards: CardWithGridId[];
  selectionMode: "single" | "multi";
  selectedCards: Set<string>;
  onCardClick: (cardId: string) => void;
  onSelectAll?: (selectAll: boolean) => void;
  isLoading: boolean;
  maxHeight?: string;
};

export function CardGrid({
  cards,
  selectionMode,
  selectedCards,
  onCardClick,
  onSelectAll,
  isLoading,
  maxHeight,
}: CardGridProps) {
  const intl = useIntl();

  const allSelected = cards.length > 0 && cards.every((card) => selectedCards.has(card.id));
  const someSelected = cards.some((card) => selectedCards.has(card.id));

  const handleSelectAllChange = () => {
    if (onSelectAll) {
      onSelectAll(!allSelected);
    }
  };

  if (cards.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <FormattedMessage
          id="card.browser.empty"
          defaultMessage="No cards found. Try adjusting your filters."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-y-auto" style={{
      maxHeight,
    }}>
      {selectionMode === "multi" && onSelectAll && cards.length > 0 && (
        <div className="flex items-center gap-2 pb-2 border-b">
          <Checkbox
            checked={allSelected}
            data-state={someSelected && !allSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
            onCheckedChange={handleSelectAllChange}
            id="select-all"
          />
          <label
            htmlFor="select-all"
            className="text-sm font-medium cursor-pointer select-none"
          >
            <FormattedMessage
              id="card.browser.selectAll"
              defaultMessage="Select all ({count})"
              values={{ count: cards.length }}
            />
          </label>
        </div>
      )}
      <div
        className="gap-4"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(120px, 20vw, 245px), 1fr))',
        }}
      >
        {cards.map((card, index) => {
          const isSelected = selectedCards.has(card.id);
          const selectionIndex = isSelected ? Array.from(selectedCards).indexOf(card.id) + 1 : 0;
          return (
            <button
              key={card.gridId}
              onClick={() => onCardClick(card.id)}
              className={cn(
                "group relative rounded-lg overflow-hidden transition-all hover:scale-105",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
                isSelected && "ring-2 ring-primary",
                "w-full"
              )}
            >
              <div className="aspect-245/337 relative">
                <Image
                  src={card.imageSmall || "/placeholder.svg"}
                  width="245"
                  height="337"
                  unoptimized
                  alt={`${card.name} - ${card.number}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {isSelected && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <div className="bg-primary rounded-full border-black border w-10 h-10 flex items-center justify-center">
                      {selectionMode === "multi" ? (
                        <span className="text-lg font-bold text-primary-foreground">{selectionIndex}</span>
                      ) : (
                        <Circle className="h-6 w-6 text-primary-foreground fill-current" />
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-2">
                <p className="text-xs text-white font-medium truncate">
                  {card.number} - {card.name}
                </p>
                <p className="text-xs text-white/70">{
                  card.price !== undefined && `${intl.formatNumber(card.price / 100, { style: "currency", currency: "EUR" })} (avg. 7d)`
                }</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* // TODO: add pagination here */}
    </div>
  );
}
