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
import { PaginationBar } from "./pagination-bar";
import { UserCardGrid } from "./user-card-grid";
import type { UserCard } from "@/components/binder/types";

const PAGE_SIZE = 120;

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
  const [page, setPage] = useState(0);

  const queryInput = {
    setIds: filters.setIds.length > 0 ? filters.setIds : undefined,
    search: filters.search || undefined,
    rarities: filters.rarities.length > 0 ? filters.rarities : undefined,
    languages: filters.languages.length > 0 ? filters.languages : undefined,
    variants: filters.variants.length > 0 ? filters.variants : undefined,
    conditions: filters.conditions.length > 0 ? filters.conditions : undefined,
    releaseDateFrom: filters.releaseDateFrom || undefined,
    releaseDateTo: filters.releaseDateTo || undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    page,
  };

  const {
    data: userCards,
    isLoading,
    isFetching,
  } = api.userCard.getList.useQuery(queryInput, {
    placeholderData: (previousData) => previousData,
  });

  const { data: countData } = api.userCard.getCount.useQuery({
    setIds: queryInput.setIds,
    search: queryInput.search,
    rarities: queryInput.rarities,
    languages: queryInput.languages,
    variants: queryInput.variants,
    conditions: queryInput.conditions,
    releaseDateFrom: queryInput.releaseDateFrom,
    releaseDateTo: queryInput.releaseDateTo,
  });

  const total = countData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const { data: filterOptions } = api.card.getFilterOptions.useQuery();

  const handleFiltersChange = (newFilters: CardQuery) => {
    setFilters(newFilters);
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <CardFilters
        onFilterChange={handleFiltersChange}
        filterOptions={filterOptions}
        enableUserCardFilters
        view={cardBrowserView}
        onViewChange={setCardBrowserView}
      />

      {totalPages > 1 && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}

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

      {totalPages > 1 && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={(p) => {
            setPage(p);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </div>
  );
}

