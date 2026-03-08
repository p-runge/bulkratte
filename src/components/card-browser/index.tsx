"use client";

import { api } from "@/lib/api/react";
import { useMemo, useState } from "react";
import { CardFilters, type CardQuery } from "./card-filters";
import { CardGrid, type CardWithPrice } from "./card-grid";

type CardBrowserSingleProps = {
  selectionMode: "single";
  onCardClick: (cardId: string) => void;
  setId?: string;
  maxHeightGrid?: string;
  /** Pre-loaded cards for client-side filtering (skips server queries). */
  staticCards?: CardWithPrice[];
  staticFilterOptions?: { rarities: string[]; setIds: string[] };
};

type CardBrowserMultiProps = {
  selectionMode: "multi";
  selectedCards: Set<string>;
  onCardClick: (cardId: string) => void;
  onSelectAll?: (cardIds: string[]) => void;
  setId?: string;
  maxHeightGrid?: string;
  /** Pre-loaded cards for client-side filtering (skips server queries). */
  staticCards?: CardWithPrice[];
  staticFilterOptions?: { rarities: string[]; setIds: string[] };
};

type CardBrowserProps = CardBrowserSingleProps | CardBrowserMultiProps;

function applyClientFilters(
  cards: CardWithPrice[],
  filters: CardQuery,
): CardWithPrice[] {
  let result = cards;

  if (filters.search) {
    const s = filters.search.toLowerCase();
    result = result.filter(
      (c) =>
        c.name.toLowerCase().includes(s) || c.number.toLowerCase().includes(s),
    );
  }

  if (filters.rarity && filters.rarity !== "all") {
    result = result.filter((c) => c.rarity === filters.rarity);
  }

  const dir = filters.sortOrder === "desc" ? -1 : 1;
  result = [...result].sort((a, b) => {
    switch (filters.sortBy) {
      case "name":
        return dir * a.name.localeCompare(b.name);
      case "rarity":
        return dir * (a.rarity ?? "").localeCompare(b.rarity ?? "");
      case "price":
        return dir * ((a.price ?? 0) - (b.price ?? 0));
      case "set-and-number":
      default: {
        const aNum = parseInt(a.number.replace(/[^0-9]/g, ""), 10) || 0;
        const bNum = parseInt(b.number.replace(/[^0-9]/g, ""), 10) || 0;
        if (aNum !== bNum) return dir * (aNum - bNum);
        return dir * a.number.localeCompare(b.number);
      }
    }
  });

  return result;
}

export function CardBrowser(props: CardBrowserProps) {
  const isStatic = !!props.staticCards;

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
      enabled: !isStatic,
      placeholderData: (previousData) => previousData,
    },
  );

  const { data: fetchedFilterOptions } = api.card.getFilterOptions.useQuery(
    { setId: props.setId || undefined },
    { enabled: !isStatic && !props.staticFilterOptions },
  );

  const filterOptions = props.staticFilterOptions ?? fetchedFilterOptions;

  const serverCards = cardListData || [];
  const filteredStaticCards = useMemo(
    () =>
      props.staticCards ? applyClientFilters(props.staticCards, filters) : null,
    [props.staticCards, filters],
  );

  const cards = filteredStaticCards ?? serverCards;

  const handleSelectAll = (selectAll: boolean) => {
    if (props.selectionMode !== "multi" || !props.onSelectAll) return;

    if (selectAll) {
      props.onSelectAll(cards.map((card) => card.id));
    } else {
      props.onSelectAll([]);
    }
  };

  return (
    <div className="space-y-6">
      <CardFilters
        onFilterChange={setFilters}
        disableSetFilter={!!props.setId}
        disableReleaseDateFilter={!!props.setId}
        filterOptions={filterOptions}
      />

      <div className="relative">
        {isFetching && !isStatic && (
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
          isLoading={isStatic ? false : isLoading}
          maxHeight={props.maxHeightGrid}
        />
      </div>
    </div>
  );
}
