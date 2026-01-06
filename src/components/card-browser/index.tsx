"use client";

import { api } from "@/lib/api/react";
import { rarityEnum } from "@/lib/db/enums";
import { useEffect, useState } from "react";
import { CardFilters, type FilterState } from "./card-filters";
import { CardGrid } from "./card-grid";

type CardBrowserCoreProps = {
  onCardClick: (cardId: string) => void;
  setId?: string;
  maxHeightGrid?: string;
};

type CardBrowserSingleProps = CardBrowserCoreProps & {
  selectionMode: "single";
};

type CardBrowserMultiProps = CardBrowserCoreProps & {
  selectionMode: "multi";
  selectedCards: Set<string>;
};

type CardBrowserSelectMultipleProps = {
  mode: "select-multiple";
  onSelect: (selectedCardIds: Set<string>) => void;
  onClose: () => void;
  setId?: string;
  maxHeightGrid?: string;
};

type CardBrowserProps = CardBrowserSingleProps | CardBrowserMultiProps | CardBrowserSelectMultipleProps;

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
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());

  const isSelectMultipleMode = "mode" in props && props.mode === "select-multiple";
  const setId = "setId" in props ? props.setId : undefined;

  const {
    data: cardListData,
    isLoading,
    refetch: fetchCards,
  } = api.card.getList.useQuery({
    setId: setId,
  });

  const handleCardClick = (cardId: string) => {
    if (isSelectMultipleMode) {
      const newSelected = new Set(selectedCards);
      if (newSelected.has(cardId)) {
        newSelected.delete(cardId);
      } else {
        newSelected.add(cardId);
      }
      setSelectedCards(newSelected);
    } else {
      props.onCardClick(cardId);
    }
  };

  const handleConfirmSelection = () => {
    if (isSelectMultipleMode) {
      props.onSelect(selectedCards);
    }
  };

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
    <>
      <div className="space-y-6">
        <CardFilters onFilterChange={setFilters} disableSetFilter={!!setId} />

        <CardGrid
          cards={cards}
          selectionMode={isSelectMultipleMode ? "multi" : ("selectionMode" in props ? props.selectionMode : "single")}
          selectedCards={isSelectMultipleMode ? selectedCards : ("selectionMode" in props && props.selectionMode === "multi" ? props.selectedCards : new Set())}
          onCardClick={handleCardClick}
          isLoading={isLoading}
          maxHeight={"maxHeightGrid" in props ? props.maxHeightGrid : undefined}
        />
      </div>

      {isSelectMultipleMode && (
        <div className="flex justify-end gap-2 pt-4 border-t mt-4 bg-background sticky bottom-0">
          <button
            onClick={props.onClose}
            className="px-4 py-2 border rounded-md hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmSelection}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            disabled={selectedCards.size === 0}
          >
            Add {selectedCards.size} card{selectedCards.size !== 1 ? "s" : ""}
          </button>
        </div>
      )}
    </>
  );
}
