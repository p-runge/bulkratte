"use client";

import { api } from "@/lib/api/react";
import { useUiPreferences } from "@/providers/ui-preferences-provider";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FormattedMessage } from "react-intl";
import {
  CardFilters,
  DEFAULT_SORT_STATE,
  EMPTY_FILTER_STATE,
  type CardQuery,
} from "./card-filters";
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

  if (filters.rarities.length > 0) {
    result = result.filter(
      (c) => c.rarity != null && filters.rarities.includes(c.rarity),
    );
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
  const showPagination = !isStatic && !props.setId;
  const PAGE_SIZE = 120;

  const {
    cardBrowserSort,
    setCardBrowserSort,
    cardBrowserView,
    setCardBrowserView,
  } = useUiPreferences();

  const [filters, setFilters] = useState<CardQuery>({
    ...EMPTY_FILTER_STATE,
    sortBy: cardBrowserSort.sortBy,
    sortOrder: cardBrowserSort.sortOrder,
  });
  const [page, setPage] = useState(0);

  const queryInput = {
    setIds: props.setId
      ? [props.setId]
      : filters.setIds.length > 0
        ? filters.setIds
        : undefined,
    search: filters.search || undefined,
    rarities: filters.rarities.length > 0 ? filters.rarities : undefined,
    releaseDateFrom: filters.releaseDateFrom || undefined,
    releaseDateTo: filters.releaseDateTo || undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    page,
  };

  const {
    data: cardListData,
    isLoading,
    isFetching,
  } = api.card.getList.useQuery(queryInput, {
    enabled: !isStatic,
    placeholderData: (previousData) => previousData,
  });

  const { data: countData } = api.card.getCount.useQuery(
    {
      setIds: queryInput.setIds,
      search: queryInput.search,
      rarities: queryInput.rarities,
      releaseDateFrom: queryInput.releaseDateFrom,
      releaseDateTo: queryInput.releaseDateTo,
    },
    { enabled: showPagination },
  );

  const totalPages = countData
    ? Math.max(1, Math.ceil(countData.total / PAGE_SIZE))
    : null;

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

  const handleFiltersChange = (newFilters: CardQuery) => {
    setFilters(newFilters);
    setPage(0);
  };

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
        onFilterChange={handleFiltersChange}
        onSortChange={setCardBrowserSort}
        view={cardBrowserView}
        onViewChange={setCardBrowserView}
        disableSetFilter={!!props.setId}
        disableReleaseDateFilter={!!props.setId}
        filterOptions={filterOptions}
        initialSort={cardBrowserSort}
      />

      {showPagination && totalPages !== null && (
        <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
      )}

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
          view={cardBrowserView}
        />
      </div>

      {showPagination && totalPages !== null && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          onPageChange={(p) => {
            setPage(p);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </div>
  );
}

function PaginationBar({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const pageOptions = Array.from({ length: totalPages }, (_, i) => i);

  return (
    <div className="flex items-center justify-center gap-3">
      <Button
        variant="outline"
        size="icon"
        disabled={page === 0}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Select
        value={String(page)}
        onValueChange={(v) => onPageChange(Number(v))}
      >
        <SelectTrigger size="sm" className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {pageOptions.map((p) => (
            <SelectItem key={p} value={String(p)}>
              <FormattedMessage
                id="card.browser.pagination.page_x_of_y"
                defaultMessage="Page {current} / {total}"
                values={{ current: p + 1, total: totalPages }}
              />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        disabled={page >= totalPages - 1}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
