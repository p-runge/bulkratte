"use client";

import { api } from "@/lib/api/react";
import { useState } from "react";
import { CardFilters, type FilterState } from "./card-filters";
import { CardGrid } from "./card-grid";

type UserCardBrowserProps = {
  onCardClick: (cardId: string) => void;
  maxHeightGrid?: string;
};

export function UserCardBrowser(props: UserCardBrowserProps) {
  const [filters, setFilters] = useState<FilterState>({
    setId: "",
    rarity: "",
    search: "",
    releaseDateFrom: "",
    releaseDateTo: "",
    sortBy: "set-and-number",
    sortOrder: "asc",
  });

  const { data: cardListData, isLoading } = api.userCard.getList.useQuery({
    setId: filters.setId && filters.setId !== "all" ? filters.setId : undefined,
    search: filters.search || undefined,
    rarity:
      filters.rarity && filters.rarity !== "all" ? filters.rarity : undefined,
    releaseDateFrom: filters.releaseDateFrom || undefined,
    releaseDateTo: filters.releaseDateTo || undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  });

  // Get unfiltered data for filter options
  const { data: unfilteredData } = api.userCard.getList.useQuery({});

  const cards = cardListData?.map((userCard) => userCard.card) ?? [];

  return (
    <div className="space-y-6">
      <CardFilters
        onFilterChange={setFilters}
        availableCards={
          unfilteredData?.map((userCard) => ({
            setId: userCard.card.setId,
            rarity: userCard.card.rarity,
          })) ?? []
        }
      />

      <CardGrid
        cards={cards}
        selectionMode="single"
        selectedCards={new Set()}
        onCardClick={props.onCardClick}
        isLoading={isLoading}
        maxHeight={props.maxHeightGrid}
      />
    </div>
  );
}
