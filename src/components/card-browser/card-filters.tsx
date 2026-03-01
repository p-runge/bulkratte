"use client";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api/react";
import { X } from "lucide-react";
import { useState } from "react";
import { useIntl } from "react-intl";

export type FilterState = {
  setId: string;
  rarity: string;
  search: string;
  releaseDateFrom: string;
  releaseDateTo: string;
};

export type SortState = {
  sortBy: "set-and-number" | "name" | "rarity" | "price";
  sortOrder: "asc" | "desc";
};

export type CardQuery = FilterState & SortState;

const EMPTY_FILTER_STATE: FilterState = {
  setId: "",
  rarity: "",
  search: "",
  releaseDateFrom: "",
  releaseDateTo: "",
};

const DEFAULT_SORT_STATE: SortState = {
  sortBy: "set-and-number",
  sortOrder: "asc",
};

type CardFiltersProps = {
  onFilterChange: (query: CardQuery) => void;
  disableSetFilter?: boolean;
  filterOptions?: {
    setIds: string[];
    rarities: string[];
  };
};

export function CardFilters({
  onFilterChange,
  disableSetFilter = false,
  filterOptions,
}: CardFiltersProps) {
  const intl = useIntl();

  const [filterState, setFilterState] =
    useState<FilterState>(EMPTY_FILTER_STATE);
  const [sortState, setSortState] = useState<SortState>(DEFAULT_SORT_STATE);

  const { data: setListData } = api.set.getList.useQuery(undefined, {
    enabled: !disableSetFilter,
  });
  const allSets = setListData || [];

  // Get available sets and rarities from filter options
  const availableSetIds = new Set(filterOptions?.setIds ?? []);
  const availableRarities = filterOptions?.rarities ?? [];

  // Filter sets to only show those with cards
  const sets = allSets.filter((set) => availableSetIds.has(set.id));

  const updateFilterValue = (key: keyof FilterState, value: string) => {
    const newFilterState = { ...filterState, [key]: value };
    setFilterState(newFilterState);
    onFilterChange({ ...newFilterState, ...sortState });
  };

  const updateSortState = (key: keyof SortState, value: string) => {
    const newSortState = { ...sortState, [key]: value } as SortState;
    setSortState(newSortState);
    onFilterChange({ ...filterState, ...newSortState });
  };

  const clearFilters = () => {
    setFilterState(EMPTY_FILTER_STATE);
    onFilterChange({ ...EMPTY_FILTER_STATE, ...sortState });
  };

  const hasActiveFilters = Object.values(filterState).some((v) => v !== "");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">
          {intl.formatMessage({
            id: "card.filter.title",
            defaultMessage: "Filter Cards",
          })}
        </h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            {intl.formatMessage({
              id: "card.filter.button.clear",
              defaultMessage: "Clear",
            })}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        <div className="flex flex-col gap-2">
          <Label htmlFor="search" className="text-sm text-muted-foreground">
            {intl.formatMessage({
              id: "card.filter.search.label",
              defaultMessage: "Search",
            })}
          </Label>
          <Input
            id="search"
            placeholder={intl.formatMessage({
              id: "card.filter.search.placeholder",
              defaultMessage: "Card name or number...",
            })}
            value={filterState.search}
            onChange={(e) => updateFilterValue("search", e.target.value)}
            className="bg-background"
          />
        </div>

        {!disableSetFilter ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="set" className="text-sm text-muted-foreground">
              {intl.formatMessage({
                id: "card.filter.set.label",
                defaultMessage: "Set",
              })}
            </Label>
            <Combobox
              value={filterState.setId}
              onValueChange={(value) => updateFilterValue("setId", value)}
              options={sets.map((set) => ({ value: set.id, label: set.name }))}
              placeholder={intl.formatMessage({
                id: "card.filter.set.placeholder",
                defaultMessage: "All sets",
              })}
              searchPlaceholder={intl.formatMessage({
                id: "card.filter.set.search",
                defaultMessage: "Search sets...",
              })}
              emptyMessage={intl.formatMessage({
                id: "card.filter.set.empty",
                defaultMessage: "No sets found",
              })}
            />
          </div>
        ) : (
          <div />
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="rarity" className="text-sm text-muted-foreground">
            {intl.formatMessage({
              id: "card.filter.rarity.label",
              defaultMessage: "Rarity",
            })}
          </Label>
          <Combobox
            value={filterState.rarity}
            onValueChange={(value) => updateFilterValue("rarity", value)}
            options={availableRarities.map((rarity) => ({
              value: rarity,
              label: rarity,
            }))}
            placeholder={intl.formatMessage({
              id: "card.filter.rarity.placeholder",
              defaultMessage: "All rarities",
            })}
            searchPlaceholder={intl.formatMessage({
              id: "card.filter.rarity.search",
              defaultMessage: "Search rarities...",
            })}
            emptyMessage={intl.formatMessage({
              id: "card.filter.rarity.empty",
              defaultMessage: "No rarities found",
            })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="date-from" className="text-sm text-muted-foreground">
            {intl.formatMessage({
              id: "card.filter.date.from",
              defaultMessage: "Release From",
            })}
          </Label>
          <Input
            id="date-from"
            type="date"
            placeholder={intl.formatMessage({
              id: "card.filter.date.placeholder.from",
              defaultMessage: "From",
            })}
            value={filterState.releaseDateFrom}
            onChange={(e) =>
              updateFilterValue("releaseDateFrom", e.target.value)
            }
            className="bg-background"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="date-to" className="text-sm text-muted-foreground">
            {intl.formatMessage({
              id: "card.filter.date.to",
              defaultMessage: "Release To",
            })}
          </Label>
          <Input
            id="date-to"
            type="date"
            placeholder={intl.formatMessage({
              id: "card.filter.date.placeholder.to",
              defaultMessage: "To",
            })}
            value={filterState.releaseDateTo}
            onChange={(e) => updateFilterValue("releaseDateTo", e.target.value)}
            className="bg-background"
          />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sort-by" className="text-sm text-muted-foreground">
            {intl.formatMessage({
              id: "card.filter.sort.label",
              defaultMessage: "Sort By",
            })}
          </Label>
          <Select
            value={sortState.sortBy}
            onValueChange={(value) => updateSortState("sortBy", value)}
          >
            <SelectTrigger id="sort-by" className="bg-background">
              <SelectValue
                placeholder={intl.formatMessage({
                  id: "card.filter.sort.placeholder",
                  defaultMessage: "Sort by",
                })}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="set-and-number">
                {intl.formatMessage({
                  id: "card.filter.sort.set-and-number",
                  defaultMessage: "Set → Number",
                })}
              </SelectItem>
              <SelectItem value="name">
                {intl.formatMessage({
                  id: "card.filter.sort.name",
                  defaultMessage: "Card Name",
                })}
              </SelectItem>
              <SelectItem value="rarity">
                {intl.formatMessage({
                  id: "card.filter.sort.rarity",
                  defaultMessage: "Card Rarity",
                })}
              </SelectItem>
              <SelectItem value="price">
                {intl.formatMessage({
                  id: "card.filter.sort.price",
                  defaultMessage: "Card Price",
                })}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="sort-order" className="text-sm text-muted-foreground">
            {intl.formatMessage({
              id: "card.filter.order.label",
              defaultMessage: "Sort Order",
            })}
          </Label>
          <Select
            value={sortState.sortOrder}
            onValueChange={(value) => updateSortState("sortOrder", value)}
          >
            <SelectTrigger id="sort-order" className="bg-background">
              <SelectValue
                placeholder={intl.formatMessage({
                  id: "card.filter.order.placeholder",
                  defaultMessage: "Sort order",
                })}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">
                {intl.formatMessage({
                  id: "card.filter.order.asc",
                  defaultMessage: "Ascending",
                })}
              </SelectItem>
              <SelectItem value="desc">
                {intl.formatMessage({
                  id: "card.filter.order.desc",
                  defaultMessage: "Descending",
                })}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
