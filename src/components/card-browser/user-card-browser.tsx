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

  const { data: filterOptions } = api.card.getFilterOptions.useQuery();

  const cards = cardListData?.map((userCard) => userCard.card) ?? [];

  return (
    <div className="space-y-6">
      <CardFilters onFilterChange={setFilters} filterOptions={filterOptions} />

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
