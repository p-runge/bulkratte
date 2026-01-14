"use client";

import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import {
  CardFilters,
  type FilterState,
} from "@/components/card-browser/card-filters";
import { CardGrid } from "@/components/card-browser/card-grid";
import Loader from "@/components/loader";

export default function WantlistPage() {
  const intl = useIntl();

  const [filters, setFilters] = useState<FilterState>({
    setId: "",
    rarity: "",
    search: "",
    releaseDateFrom: "",
    releaseDateTo: "",
    sortBy: "number",
    sortOrder: "asc",
  });

  const { data: wantlistData, isLoading } = api.userCard.getWantlist.useQuery({
    setId: filters.setId && filters.setId !== "all" ? filters.setId : undefined,
    search: filters.search || undefined,
    rarity:
      filters.rarity && filters.rarity !== "all" ? filters.rarity : undefined,
    releaseDateFrom: filters.releaseDateFrom || undefined,
    releaseDateTo: filters.releaseDateTo || undefined,
    sortBy: filters.sortBy as "number" | "name" | "rarity" | "price",
    sortOrder: filters.sortOrder,
  });

  // Map cards to include gridId for CardGrid component
  const wantlistCards =
    wantlistData?.map((card) => ({
      ...card,
      gridId: card.id,
    })) ?? [];

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {intl.formatMessage({
            id: "page.collection.wantlist.title",
            defaultMessage: "My Wantlist",
          })}
        </h1>
        <p className="text-muted-foreground">
          {intl.formatMessage({
            id: "page.collection.wantlist.description",
            defaultMessage: "Cards you are still missing in your custom sets",
          })}
        </p>
      </div>

      <div className="space-y-6">
        <CardFilters onFilterChange={setFilters} disableSetFilter={false} />

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : wantlistCards.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-lg font-semibold mb-2">
                {intl.formatMessage({
                  id: "page.collection.wantlist.empty.title",
                  defaultMessage: "Your wantlist is empty!",
                })}
              </h3>
              <p className="text-muted-foreground">
                {intl.formatMessage({
                  id: "page.collection.wantlist.empty.description",
                  defaultMessage: "You have all cards in your custom sets!",
                })}
              </p>
            </CardContent>
          </Card>
        ) : (
          <CardGrid
            cards={wantlistCards}
            selectionMode="single"
            selectedCards={new Set()}
            onCardClick={(cardId) => {
              console.log("Card clicked:", cardId);
            }}
            isLoading={isLoading}
          />
        )}
      </div>
    </>
  );
}
