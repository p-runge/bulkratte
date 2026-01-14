"use client";

import { Button } from "@/components/ui/button";
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
import { rarityEnum } from "@/lib/db/enums";
import { X } from "lucide-react";
import { useState } from "react";
import { useIntl } from "react-intl";

export type FilterState = {
  setId: string;
  rarity: string;
  search: string;
  releaseDateFrom: string;
  releaseDateTo: string;
  sortBy: "set-and-number" | "name" | "rarity" | "price";
  sortOrder: "asc" | "desc";
};
const EMPTY_FILTERS: FilterState = {
  setId: "",
  rarity: "",
  search: "",
  releaseDateFrom: "",
  releaseDateTo: "",
  sortBy: "set-and-number",
  sortOrder: "asc",
};

type CardFiltersProps = {
  onFilterChange: (filters: FilterState) => void;
  disableSetFilter?: boolean;
  availableCards?: Array<{ setId: string; rarity: string | null }>;
};

export function CardFilters({
  onFilterChange,
  disableSetFilter = false,
  availableCards = [],
}: CardFiltersProps) {
  const intl = useIntl();

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  const { data: setListData } = api.set.getList.useQuery(undefined, {
    enabled: !disableSetFilter,
  });
  const allSets = setListData || [];

  // Compute available sets and rarities from the card data
  const availableSetIds = new Set(availableCards.map((card) => card.setId));
  const availableRarities = new Set(
    availableCards
      .map((card) => card.rarity)
      .filter((r): r is string => r !== null),
  );

  // Filter sets to only show those with cards
  const sets = allSets.filter((set) => availableSetIds.has(set.id));

  // Filter rarities to only show those that exist in the data
  const rarities = rarityEnum.enumValues.filter((rarity) =>
    availableRarities.has(rarity),
  );

  const updateFilter = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    onFilterChange(EMPTY_FILTERS);
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

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
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
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
            <Select
              value={filters.setId}
              onValueChange={(value) => updateFilter("setId", value)}
            >
              <SelectTrigger id="set" className="bg-background">
                <SelectValue
                  placeholder={intl.formatMessage({
                    id: "card.filter.set.placeholder",
                    defaultMessage: "All sets",
                  })}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {intl.formatMessage({
                    id: "card.filter.set.all",
                    defaultMessage: "All sets",
                  })}
                </SelectItem>
                {sets.map((set) => (
                  <SelectItem key={set.id} value={set.id}>
                    {set.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <Select
            value={filters.rarity}
            onValueChange={(value) => updateFilter("rarity", value)}
          >
            <SelectTrigger id="rarity" className="bg-background">
              <SelectValue
                placeholder={intl.formatMessage({
                  id: "card.filter.rarity.placeholder",
                  defaultMessage: "All rarities",
                })}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {intl.formatMessage({
                  id: "card.filter.rarity.all",
                  defaultMessage: "All rarities",
                })}
              </SelectItem>
              {rarities.map((rarity) => (
                <SelectItem key={rarity} value={rarity}>
                  {rarity}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            value={filters.releaseDateFrom}
            onChange={(e) => updateFilter("releaseDateFrom", e.target.value)}
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
            value={filters.releaseDateTo}
            onChange={(e) => updateFilter("releaseDateTo", e.target.value)}
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
            value={filters.sortBy}
            onValueChange={(value) => updateFilter("sortBy", value)}
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
            value={filters.sortOrder}
            onValueChange={(value) =>
              updateFilter("sortOrder", value as "asc" | "desc")
            }
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
