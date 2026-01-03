"use client";

import { api } from "@/lib/api/react";
import { useEffect, useState } from "react";
import { CardFilters, type FilterState } from "./card-filters";
import { CardGrid, CardWithGridId } from "./card-grid";

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
    sortBy: "number",
    sortOrder: "asc",
  });
  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(
    null
  );

  const {
    data,
    isLoading,
    refetch: fetchUserCards,
  } = api.userCard.getList.useQuery();
  const cards = data?.map((userCard) => ({
    gridId: userCard.id,
    ...userCard.card!,
  })) as CardWithGridId[];

  // Handle filter changes with debounce for search
  useEffect(() => {
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }

    const timeout = setTimeout(
      () => {
        fetchUserCards();
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
        selectionMode="single"
        selectedCards={new Set()}
        onCardClick={props.onCardClick}
        isLoading={isLoading}
        maxHeight={props.maxHeightGrid}
      />
    </div>
  );
}
