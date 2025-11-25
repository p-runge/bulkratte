"use client";

import { api } from "@/lib/api/react";
import { useEffect, useState } from "react";
import { CardFilters, type FilterState } from "./card-filters";
import { CardGrid } from "./card-grid";

type CardBrowserSingleProps = {
  selectionMode: "single";
  onCardClick: (cardId: string) => void;
  maxHeightGrid?: string;
};

type CardBrowserMultiProps = {
  selectionMode: "multi";
  selectedCards: Set<string>;
  onCardClick: (cardId: string) => void;
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
  });
  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(
    null
  );

  const {
    data: cardListData,
    isLoading,
    refetch: fetchCards,
  } = api.card.getList.useQuery();
  const cards = cardListData || [];

  // Handle filter changes with debounce for search
  useEffect(() => {
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }

    const timeout = setTimeout(
      () => {
        fetchCards();
      },
      filters.search ? 500 : 0
    ); // Debounce search by 500ms

    setSearchDebounce(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <div className="space-y-6">
      <CardFilters onFilterChange={setFilters} />

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
