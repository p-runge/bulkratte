"use client";

import { CardBrowser } from "@/components/card-browser";
import type { CardWithPrice } from "@/components/card-browser/card-grid";
import { CardImageDialog } from "@/components/card-image";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Set as PokemonSet } from "@/lib/db";
import Image from "next/image";
import { useMemo, useState } from "react";

type Props = {
  set: PokemonSet;
  initialCards: CardWithPrice[];
};

export default function Content({ set, initialCards }: Props) {
  const [selectedCard, setSelectedCard] = useState<CardWithPrice | null>(null);

  const staticFilterOptions = useMemo(
    () => ({
      setIds: [set.id],
      rarities: [
        ...new Set(
          initialCards.flatMap((c) => (c.rarity != null ? [c.rarity] : [])),
        ),
      ] as string[],
    }),
    [set.id, initialCards],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              <div className="text-xl font-semibold mb-4 border-b pb-2 flex items-center">
                {set.logo && (
                  <Image
                    src={set.logo}
                    alt={set.name}
                    width={64}
                    height={64}
                    unoptimized
                    className="inline-block w-16 h-16 object-contain object-center mr-3"
                  />
                )}

                <div className="text-2xl font-bold">
                  <div className="mb-1">
                    <h1 className="inline">{set.name}</h1>

                    <span className="text-muted-foreground ml-2">
                      ({new Date(set.releaseDate).getFullYear()})
                    </span>
                  </div>
                </div>
              </div>
            </CardTitle>
          </div>
        </CardHeader>
      </Card>

      <CardBrowser
        selectionMode="single"
        setId={set.id}
        staticCards={initialCards}
        staticFilterOptions={staticFilterOptions}
        onCardClick={(cardId) => {
          const card = initialCards.find((c) => c.id === cardId);
          if (card) {
            setSelectedCard(card);
          }
        }}
      />

      {selectedCard && (
        <CardImageDialog
          large={selectedCard.imageLarge}
          alt={`${selectedCard.name} card image`}
          open={!!selectedCard}
          onOpenChange={(open) => !open && setSelectedCard(null)}
        />
      )}
    </div>
  );
}
