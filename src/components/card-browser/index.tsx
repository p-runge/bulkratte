"use client";

import { api } from "@/lib/api/react";
import { useState } from "react";
import { CardFilters, type CardQuery } from "./card-filters";
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
  onSelectAll?: (cardIds: string[]) => void;
  setId?: string;
  maxHeightGrid?: string;
};

type CardBrowserProps = CardBrowserSingleProps | CardBrowserMultiProps;

export function CardBrowser(props: CardBrowserProps) {
  const [filters, setFilters] = useState<CardQuery>({
    setId: "",
    rarity: "",
    search: "",
    releaseDateFrom: "",
    releaseDateTo: "",
    sortBy: "set-and-number",
    sortOrder: "asc",
  });

  const {
    data: cardListData,
    isLoading,
    isFetching,
  } = api.card.getList.useQuery(
    {
      setId:
        props.setId ||
        (filters.setId && filters.setId !== "all" ? filters.setId : undefined),
      search: filters.search || undefined,
      rarity:
        filters.rarity && filters.rarity !== "all" ? filters.rarity : undefined,
      releaseDateFrom: filters.releaseDateFrom || undefined,
      releaseDateTo: filters.releaseDateTo || undefined,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    },
    {
      placeholderData: (previousData) => previousData,
    },
  );
  const cards = cardListData || [];

  const { data: filterOptions } = api.card.getFilterOptions.useQuery({
    setId: props.setId || undefined,
  });

  const handleSelectAll = (selectAll: boolean) => {
    if (props.selectionMode !== "multi" || !props.onSelectAll) return;

    if (selectAll) {
      // Select all cards
      props.onSelectAll(cards.map((card) => card.id));
    } else {
      // Deselect all cards
      props.onSelectAll([]);
    }
  };

  return (
    <div className="space-y-6">
      <CardFilters
        onFilterChange={setFilters}
        disableSetFilter={!!props.setId}
        filterOptions={filterOptions}
      />

      <div className="relative">
        {isFetching && (
          <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-[1px] pointer-events-auto cursor-wait" />
        )}
        <CardGrid
          cards={cards}
          selectionMode={props.selectionMode}
          selectedCards={
            props.selectionMode === "multi" ? props.selectedCards : new Set()
          }
          onCardClick={props.onCardClick}
          onSelectAll={
            props.selectionMode === "multi" ? handleSelectAll : undefined
          }
          isLoading={isLoading}
          maxHeight={props.maxHeightGrid}
        />
      </div>
    </div>
  );
}
