"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
// import { PokemonCard, PokemonSet } from "@/lib/pokemon-api";
import { cn } from "@/lib/utils";
import {
  Circle,
  Diamond,
  Grid,
  List,
  Search,
  Star
} from "lucide-react";
import Image from "next/image";
import { Rarity } from "pokemon-tcg-sdk-typescript/dist/sdk";
import { ReactNode, useState } from "react";
import { useIntl } from 'react-intl';
import CardImage from "./card-image";
import { Set as PokemonSet, Card as PokemonCard } from "@/lib/db"

type Props = {
  set: PokemonSet;
  cards: PokemonCard[];
};
export default function Content({ set, cards }: Props) {
  const intl = useIntl();

  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterRarity] = useState<string>("all");

  const filteredCards = cards.filter((card) => {
    const matchesSearch =
      card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.number.includes(searchTerm);
    const matchesRarity =
      filterRarity === "all" || card.rarity === filterRarity;
    return matchesSearch && matchesRarity;
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
                    className="inline-block w-16 h-16 object-contain object-center mr-3"
                    unoptimized
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

                <div className="flex gap-2 items-center">
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
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cards Display */}
          {
            <div
              className={cn(
                viewMode === "grid" && "grid grid-cols-2 md:flex md:flex-wrap gap-2 justify-between",
                viewMode === "list" && "space-y-2"
              )}
            >
              {filteredCards.map((card) => (
                <Card
                  key={card.id}
                  className={cn("transition-all p-0")}
                >
                  <CardContent className="p-2">
                    <div className="mb-2">
                      <h3
                        className="font-semibold truncate"
                        title={card.name}
                      >
                        {card.name}
                      </h3>
                      <div className="text-sm flex items-center gap-2">
                        {/* base set has no symbol */}
                        {set.symbol && (
                          <Image
                            src={set.symbol}
                            alt={`${set.name} symbol`}
                            width={16}
                            height={16}
                            unoptimized
                          />
                        )}

                        <span>({`${card.number}/${set.total}`})</span>

                        {rarityIconMap[card.rarity as Rarity] ?? (
                          <span>{card.rarity}</span>
                        )}
                      </div>
                    </div>

                    {/* Card Thumbnail */}
                    <div className="relative">
                      <CardImage
                        small={card.imageSmall}
                        large={card.imageLarge}
                        alt={card.name}
                        width={245}
                        height={337}
                        className="w-min-[100px]  w-max-[245px] h-auto object-cover rounded border shadow-sm"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          }

          {filteredCards.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground">
                  {intl.formatMessage({ id: "noCardsFound", defaultMessage: "No cards found matching your search criteria." })}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

const rarityIconMap = {
  Common: <Circle className="w-3 h-3 fill-black" />,
  Uncommon: <Diamond className="w-3 h-3 fill-black" />,
  Rare: <Star className="w-3 h-3 fill-black" />,
  "Rare Holo": (
    <span className="flex items-center">
      <Star className="w-3 h-3 fill-black" />
      <span className="text-xs">H</span>
    </span>
  ),
} as Partial<Record<Rarity, ReactNode>>;
