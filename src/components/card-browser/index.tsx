"use client";

import { api } from "@/lib/api/react";
import { useEffect, useState } from "react";
import { CardFilters, type FilterState } from "./card-filters";
import { CardGrid } from "./card-grid";

type CardBrowserCoreProps = {
  onCardClick: (cardId: string) => void;
  setId?: string;
  maxHeightGrid?: string;
  // Common props can be defined here if needed
};

type CardBrowserSingleProps = CardBrowserCoreProps & {
  selectionMode: "single";
};

type CardBrowserMultiProps = CardBrowserCoreProps & {
  selectionMode: "multi";
  selectedCards: Set<string>;
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
  } = api.card.getList.useQuery({
    setId: props.setId,
  });
  const cards = cardListData?.map((card) => ({
    ...card,
    gridId: card.id,
  })) ?? [];

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
