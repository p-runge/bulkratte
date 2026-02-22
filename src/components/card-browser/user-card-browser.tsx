"use client";

import { api } from "@/lib/api/react";
import { useState } from "react";
import { CardFilters, type FilterState } from "./card-filters";
import { UserCardGrid } from "./user-card-grid";
import type { UserCard } from "@/components/binder/types";

type UserCardBrowserProps = {
  onCardClick: (userCard: UserCard) => void;
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

  const {
    data: userCards,
    isLoading,
    isFetching,
  } = api.userCard.getList.useQuery(
    {
      setId:
        filters.setId && filters.setId !== "all" ? filters.setId : undefined,
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

  const { data: filterOptions } = api.card.getFilterOptions.useQuery();

  return (
    <div className="space-y-6">
      <CardFilters onFilterChange={setFilters} filterOptions={filterOptions} />

      <div className="relative">
        {isFetching && (
          <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-[1px] pointer-events-auto cursor-wait" />
        )}
        <UserCardGrid
          userCards={userCards ?? []}
          selectionMode="single"
          selectedUserCardIds={new Set()}
          onUserCardClick={props.onCardClick}
          isLoading={isLoading}
          maxHeight={props.maxHeightGrid}
        />
      </div>
    </div>
  );
}
