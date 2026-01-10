"use client";

import { api } from "@/lib/api/react";
import { useState } from "react";
import { CardFilters, type FilterState } from "./card-filters";
import { CardGrid } from "./card-grid";

type CardBrowserSingleProps = {
  selectionMode: "single";
  onCardClick: (cardId: string) => void;
  setId?: string;
  maxHeightGrid?: string;
};

type CardBrowserMultiProps = {
  selectionMode: "multi";
  selectedCards: Set<string>;
  onCardClick: (cardId: string) => void;
  setId?: string;
  maxHeightGrid?: string;
};

type CardBrowserProps = CardBrowserSingleProps | CardBrowserMultiProps;

export function CardBrowser(props: CardBrowserProps) {
  const [filters, setFilters] = useState<FilterState>({
    setId: "",
    rarity: "",
    search: "",
    releaseDateFrom: "",
    releaseDateTo: "",
    sortBy: "number",
    sortOrder: "asc",
  });

  const {
    data: cardListData,
    isLoading,
  } = api.card.getList.useQuery({
    setId: props.setId || (filters.setId && filters.setId !== "all" ? filters.setId : undefined),
    search: filters.search || undefined,
    rarity: filters.rarity && filters.rarity !== "all" ? filters.rarity : undefined,
    releaseDateFrom: filters.releaseDateFrom || undefined,
    releaseDateTo: filters.releaseDateTo || undefined,
    sortBy: filters.sortBy as "number" | "name" | "rarity" | "price",
    sortOrder: filters.sortOrder,
  });

  // Map cards to include gridId
  const cards = (cardListData?.map((card) => ({
    ...card,
    gridId: card.id,
  })) ?? []);

  return (
    <div className="space-y-6">
      <CardFilters onFilterChange={setFilters} disableSetFilter={!!props.setId} />

      <CardGrid
        cards={cards}
        selectionMode={props.selectionMode}
        selectedCards={props.selectionMode === "multi" ? props.selectedCards : new Set()}
        onCardClick={props.onCardClick}
        isLoading={isLoading}
        maxHeight={props.maxHeightGrid}
      />
    </div>
  );
}
