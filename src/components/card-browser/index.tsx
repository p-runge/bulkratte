"use client";

import { api } from "@/lib/api/react";
import { rarityEnum } from "@/lib/db/enums";
import { useEffect, useState } from "react";
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

  // Map cards and apply sorting
  const cards = (cardListData?.map((card) => ({
    ...card,
    gridId: card.id,
  })) ?? []).sort((a, b) => {
    let comparison = 0;

    switch (filters.sortBy) {
      case "number":
        // Extract numeric part from card number for proper sorting
        const numA = parseInt(a.number.replace(/\D/g, "")) || 0;
        const numB = parseInt(b.number.replace(/\D/g, "")) || 0;
        comparison = numA - numB;
        break;
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "rarity":
        // Sort by rarity using the order defined in the enum
        const rarityOrder = rarityEnum.enumValues;
        const indexA = a.rarity ? rarityOrder.indexOf(a.rarity) : -1;
        const indexB = b.rarity ? rarityOrder.indexOf(b.rarity) : -1;
        comparison = indexA - indexB;
        break;
      case "price":
        const priceA = a.price ?? 0;
        const priceB = b.price ?? 0;
        comparison = priceA - priceB;
        break;
      default:
        comparison = 0;
    }

    return filters.sortOrder === "asc" ? comparison : -comparison;
  });

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
