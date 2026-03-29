"use client";

import { api } from "@/lib/api/react";
import { useUiPreferences } from "@/providers/ui-preferences-provider";
import { useState } from "react";
import {
  CardFilters,
  DEFAULT_SORT_STATE,
  EMPTY_FILTER_STATE,
  type CardQuery,
} from "./card-filters";
import { UserCardGrid } from "./user-card-grid";
import type { UserCard } from "@/components/binder/types";

type UserCardBrowserProps = {
  onCardClick: (userCard: UserCard) => void;
  maxHeightGrid?: string;
};

export function UserCardBrowser(props: UserCardBrowserProps) {
  const { cardBrowserView, setCardBrowserView } = useUiPreferences();
  const [filters, setFilters] = useState<CardQuery>({
    ...EMPTY_FILTER_STATE,
    ...DEFAULT_SORT_STATE,
  });

  const {
    data: userCards,
    isLoading,
    isFetching,
  } = api.userCard.getList.useQuery(
    {
      setIds: filters.setIds.length > 0 ? filters.setIds : undefined,
      search: filters.search || undefined,
      rarities: filters.rarities.length > 0 ? filters.rarities : undefined,
      languages: filters.languages.length > 0 ? filters.languages : undefined,
      variants: filters.variants.length > 0 ? filters.variants : undefined,
      conditions:
        filters.conditions.length > 0 ? filters.conditions : undefined,
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
      <CardFilters
        onFilterChange={setFilters}
        filterOptions={filterOptions}
        enableUserCardFilters
        view={cardBrowserView}
        onViewChange={setCardBrowserView}
      />

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
          view={cardBrowserView}
        />
      </div>
    </div>
  );
}
