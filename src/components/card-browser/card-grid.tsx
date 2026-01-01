"use client";

import type { Card } from "@/lib/db";
import { cn } from "@/lib/utils";
import { Check, Circle } from "lucide-react";
import Image from "next/image";
import { FormattedMessage } from "react-intl";

export type CardWithGridId = Card & { gridId: string };

type CardGridProps = {
  cards: CardWithGridId[];
  selectionMode: "single" | "multi";
  selectedCards: Set<string>;
  onCardClick: (cardId: string) => void;
  isLoading: boolean;
  maxHeight?: string;
};

export function CardGrid({
  cards,
  selectionMode,
  selectedCards,
  onCardClick,
  isLoading,
  maxHeight,
}: CardGridProps) {
  if (cards.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <FormattedMessage
          id="no_cards_found"
          defaultMessage="No cards found. Try adjusting your filters."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-y-auto" style={{
      maxHeight,
    }}>
      <div
        className="gap-4"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(120px, 20vw, 245px), 1fr))',
        }}
      >
        {cards.map((card) => {
          const isSelected = selectedCards.has(card.id);
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
                    <div className="bg-primary rounded-full p-2 border-black border">
                      {selectionMode === "multi" ? (
                        <Check className="h-6 w-6 text-primary-foreground" />
                      ) : (
                        <Circle className="h-6 w-6 text-primary-foreground fill-current" />
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-2">
                <p className="text-xs text-white font-medium truncate">
                  {card.name}
                </p>
                <p className="text-xs text-white/70">{card.number}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* // TODO: add pagination here */}
    </div>
  );
}
