"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { Card } from "@/lib/db";
import { cn } from "@/lib/utils";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Circle } from "lucide-react";
import Image from "next/image";
import { FormattedMessage, useIntl } from "react-intl";
import Loader from "../loader";
import type { CardBrowserView } from "@/providers/ui-preferences-provider";

export type CardWithPrice = Card & { price: number | undefined };

type CardGridProps = {
  cards: CardWithPrice[];
  selectionMode: "single" | "multi";
  selectedCards: Set<string>;
  onCardClick: (cardId: string) => void;
  onSelectAll?: (selectAll: boolean) => void;
  isLoading: boolean;
  maxHeight?: string;
  view?: CardBrowserView;
};

export function CardGrid({
  cards,
  selectionMode,
  selectedCards,
  onCardClick,
  onSelectAll,
  isLoading,
  maxHeight,
  view = "grid",
}: CardGridProps) {
  const intl = useIntl();
  const [parent] = useAutoAnimate();

  const allSelected =
    cards.length > 0 && cards.every((card) => selectedCards.has(card.id));
  const someSelected = cards.some((card) => selectedCards.has(card.id));

  const handleSelectAllChange = () => {
    if (onSelectAll) {
      onSelectAll(!allSelected);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center">
        <Loader />
      </div>
    );
  }

  if (cards.length === 0) {
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
    <div
      className="space-y-4 overflow-y-auto"
      style={{
        maxHeight,
      }}
    >
      {selectionMode === "multi" && onSelectAll && cards.length > 0 && (
        <div className="flex items-center gap-2 pb-2 border-b">
          <Checkbox
            checked={allSelected}
            data-state={
              someSelected && !allSelected
                ? "indeterminate"
                : allSelected
                  ? "checked"
                  : "unchecked"
            }
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

      {view === "grid" ? (
        <div
          ref={parent}
          className="gap-4"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(clamp(120px, 20vw, 245px), 1fr))",
          }}
        >
          {cards.map((card, index) => {
            const isSelected = selectedCards.has(card.id);
            const selectionIndex = isSelected
              ? Array.from(selectedCards).indexOf(card.id) + 1
              : 0;
            return (
              <button
                key={card.id}
                onClick={() => onCardClick(card.id)}
                className={cn(
                  "group relative rounded-lg overflow-hidden transition-all hover:scale-105",
                  "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
                  isSelected && "ring-2 ring-primary",
                  "w-full",
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
                          <span className="text-lg font-bold text-primary-foreground">
                            {selectionIndex}
                          </span>
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
                  <p className="text-xs text-white/70">
                    {card.price !== undefined &&
                      `${intl.formatNumber(card.price / 100, { style: "currency", currency: "EUR" })} (avg. 7d)`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div ref={parent} className="flex flex-col divide-y">
          {cards.map((card) => {
            const isSelected = selectedCards.has(card.id);
            const selectionIndex = isSelected
              ? Array.from(selectedCards).indexOf(card.id) + 1
              : 0;
            return (
              <button
                key={card.id}
                onClick={() => onCardClick(card.id)}
                className={cn(
                  "flex items-center gap-3 py-2 px-1 text-left transition-colors hover:bg-muted/50 rounded-sm",
                  "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset",
                  isSelected && "bg-primary/10",
                )}
              >
                {/* Selection indicator */}
                <div className="shrink-0 w-6 flex justify-center">
                  {isSelected ? (
                    <div className="bg-primary rounded-full w-6 h-6 flex items-center justify-center">
                      {selectionMode === "multi" ? (
                        <span className="text-xs font-bold text-primary-foreground">
                          {selectionIndex}
                        </span>
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-primary-foreground fill-current" />
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Card thumbnail */}
                <div className="shrink-0 w-9 h-[50px] rounded overflow-hidden relative">
                  <Image
                    src={card.imageSmall || "/placeholder.svg"}
                    width="36"
                    height="50"
                    unoptimized
                    alt={`${card.name} - ${card.number}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* Number */}
                <span className="shrink-0 w-12 text-xs text-muted-foreground tabular-nums">
                  {card.number}
                </span>

                {/* Name */}
                <span className="flex-1 min-w-0 text-sm font-medium truncate">
                  {card.name}
                </span>

                {/* Rarity */}
                <span className="hidden sm:block shrink-0 text-xs text-muted-foreground w-24 truncate text-right">
                  {card.rarity ?? "—"}
                </span>

                {/* Price */}
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground w-20 text-right">
                  {card.price !== undefined
                    ? intl.formatNumber(card.price / 100, {
                        style: "currency",
                        currency: "EUR",
                      })
                    : "—"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* // TODO: add pagination here */}
    </div>
  );
}
