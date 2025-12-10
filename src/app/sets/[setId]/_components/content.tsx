"use client";

import { CardBrowser } from "@/components/card-browser";
import { CardImageDialog } from "@/components/card-image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/react";
import { Card as CardType, Set as PokemonSet } from "@/lib/db";
import {
  Search
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useIntl } from 'react-intl';

type Props = {
  set: PokemonSet;
};
export default function Content({ set }: Props) {
  const intl = useIntl();

  const [searchTerm, setSearchTerm] = useState("");
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
        <>
          {/* Controls */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-4 items-center">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder={intl.formatMessage({ id: "search.placeholder", defaultMessage: "Search cards..." })}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>

                  {/* <Select value={filterRarity} onValueChange={setFilterRarity}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{intl.formatMessage({ id: "rarity.all", defaultMessage: "All Rarities" })}</SelectItem>
                      {Object.values(rarityEnum).map((rarity) => (
                        <SelectItem key={rarity} value={rarity}>
                          {rarity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select> */}
                </div>

                {/* 
                  // TODO: uncomment this when list view is redesigned
                */}
                {/* <div className="flex gap-2 items-center">
                  <Toggle
                    pressed={viewMode === "grid"}
                    onPressedChange={() => setViewMode("grid")}
                    size="sm"
                  >
                    <Grid className="h-4 w-4" />
                  </Toggle>
                  <Toggle
                    pressed={viewMode === "list"}
                    onPressedChange={() => setViewMode("list")}
                    size="sm"
                  >
                    <List className="h-4 w-4" />
                  </Toggle>
                </div> */}
              </div>
            </CardContent>
          </Card>

          {/* Cards Display */}
          <CardBrowser selectionMode="single" onCardClick={
            (cardId) => {
              const card = cards?.find((c) => c.id === cardId);
              if (card) {
                setSelectedCard(card);
              }
            }
          } setId={set.id} />
        </>
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
