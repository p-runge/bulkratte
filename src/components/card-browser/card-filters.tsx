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
import { Slider } from "@/components/ui/slider";
import { api } from "@/lib/api/react";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";

function dateToMonthIndex(dateString: string): number {
  const date = new Date(dateString + "T00:00:00");
  return date.getFullYear() * 12 + date.getMonth();
}

function monthIndexToStartDateString(monthIndex: number): string {
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex % 12;
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

function monthIndexToEndDateString(monthIndex: number): string {
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

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

  const { data: setListData } = api.set.getList.useQuery();
  const allSets = setListData || [];

  // Get available sets and rarities from filter options
  const availableSetIds = new Set(filterOptions?.setIds ?? []);
  const availableRarities = filterOptions?.rarities ?? [];

  // Filter sets to only show those with cards
  const sets = allSets.filter((set) => availableSetIds.has(set.id));

  // Compute min/max month indices from all sets
  const { minMonthIndex, maxMonthIndex } = useMemo(() => {
    if (allSets.length === 0) {
      const now = new Date();
      const current = now.getFullYear() * 12 + now.getMonth();
      return { minMonthIndex: current, maxMonthIndex: current };
    }
    const dates = allSets.map((s) => dateToMonthIndex(s.releaseDate));
    return {
      minMonthIndex: Math.min(...dates),
      maxMonthIndex: Math.max(...dates),
    };
  }, [allSets]);

  // Derive slider values from filterState (fall back to global bounds when empty)
  const sliderFromValue = filterState.releaseDateFrom
    ? dateToMonthIndex(filterState.releaseDateFrom)
    : minMonthIndex;
  const sliderToValue = filterState.releaseDateTo
    ? dateToMonthIndex(filterState.releaseDateTo)
    : maxMonthIndex;

  const updateFilterValue = (key: keyof FilterState, value: string) => {
    const newFilterState = { ...filterState, [key]: value };
    setFilterState(newFilterState);
    onFilterChange({ ...newFilterState, ...sortState });
  };

  const handleDateSliderChange = (values: number[]) => {
    const [from, to] = values as [number, number];
    const newFrom =
      from === minMonthIndex ? "" : monthIndexToStartDateString(from);
    const newTo = to === maxMonthIndex ? "" : monthIndexToEndDateString(to);
    const newFilterState = {
      ...filterState,
      releaseDateFrom: newFrom,
      releaseDateTo: newTo,
    };
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
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
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">
            {intl.formatMessage({
              id: "card.filter.date.label",
              defaultMessage: "Release Date",
            })}
          </Label>
          <span className="text-sm text-muted-foreground tabular-nums">
            {intl.formatDate(
              new Date(
                Math.floor(sliderFromValue / 12),
                sliderFromValue % 12,
                1,
              ),
              { month: "short", year: "numeric" },
            )}
            {" – "}
            {intl.formatDate(
              new Date(Math.floor(sliderToValue / 12), sliderToValue % 12, 1),
              { month: "short", year: "numeric" },
            )}
          </span>
        </div>
        <Slider
          min={minMonthIndex}
          max={maxMonthIndex}
          step={1}
          value={[sliderFromValue, sliderToValue]}
          onValueChange={handleDateSliderChange}
          disabled={minMonthIndex === maxMonthIndex}
          className="w-full"
        />
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
