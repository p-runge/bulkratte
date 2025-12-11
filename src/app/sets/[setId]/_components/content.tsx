"use client";

import { CardBrowser } from "@/components/card-browser";
import { CardImageDialog } from "@/components/card-image";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api/react";
import { Card as CardType, Set as PokemonSet } from "@/lib/db";
import Image from "next/image";
import { useState } from "react";

type Props = {
  set: PokemonSet;
};
export default function Content({ set }: Props) {
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);

  const { data: cards } = api.card.getList.useQuery({
    setId: set.id,
  });

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

      {set && (
        <CardBrowser selectionMode="single" onCardClick={
          (cardId) => {
            const card = cards?.find((c) => c.id === cardId);
            if (card) {
              setSelectedCard(card);
            }
          }
        } setId={set.id} />
      )}

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

// const rarityIconMap = {
//   Common: <Circle className="w-3 h-3 fill-black" />,
//   Uncommon: <Diamond className="w-3 h-3 fill-black" />,
//   Rare: <Star className="w-3 h-3 fill-black" />,
//   "Rare Holo": (
//     <span className="flex items-center">
//       <Star className="w-3 h-3 fill-black" />
//       <span className="text-xs">H</span>
//     </span>
//   ),
// } as Partial<Record<Rarity, ReactNode>>;
