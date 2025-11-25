"use client";

import type { Card } from "@/lib/db";
import { cn } from "@/lib/utils";
import { Check, Circle } from "lucide-react";
import Image from "next/image";

type CardGridProps = {
  cards: Card[];
  selectionMode: "single" | "multi";
  selectedCards: Set<string>;
  onCardClick: (cardId: string) => void;
  isLoading: boolean;
};

export function CardGrid({
  cards,
  selectionMode,
  selectedCards,
  onCardClick,
  isLoading,
}: CardGridProps) {
  if (cards.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No cards found. Try adjusting your filters.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        {cards.map((card) => {
          const isSelected = selectedCards.has(card.id);
          return (
            <button
              key={card.id}
              onClick={() => onCardClick(card.id)}
              className={cn(
                "group relative rounded-lg overflow-hidden transition-all hover:scale-105",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
                isSelected && "ring-2 ring-primary"
              )}
            >
              <div className="aspect-[2.5/3.5] relative">
                <Image
                  src={card.imageSmall || "/placeholder.svg"}
                  width="250"
                  height="350"
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
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
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
