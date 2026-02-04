"use client";

import {
  CardFilters,
  type FilterState,
} from "@/components/card-browser/card-filters";
import { CardGrid } from "@/components/card-browser/card-grid";
import Loader from "@/components/loader";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api/react";
import { use, useState } from "react";
import { useIntl } from "react-intl";

export default function UserWantlistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const intl = useIntl();

  const [filters, setFilters] = useState<FilterState>({
    setId: "",
    rarity: "",
    search: "",
    releaseDateFrom: "",
    releaseDateTo: "",
    sortBy: "set-and-number",
    sortOrder: "asc",
  });

  const { data: wantlistData, isLoading } =
    api.userCard.getPublicWantlist.useQuery({
      userId: id,
      setId:
        filters.setId && filters.setId !== "all" ? filters.setId : undefined,
      search: filters.search || undefined,
      rarity:
        filters.rarity && filters.rarity !== "all" ? filters.rarity : undefined,
      releaseDateFrom: filters.releaseDateFrom || undefined,
      releaseDateTo: filters.releaseDateTo || undefined,
      sortBy: filters.sortBy as "set-and-number" | "name" | "rarity" | "price",
      sortOrder: filters.sortOrder,
    });

  // Get unfiltered data for filter options
  const { data: unfilteredWantlistData } =
    api.userCard.getPublicWantlist.useQuery({
      userId: id,
    });

  const wantlistCards = wantlistData ?? [];

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {intl.formatMessage({
            id: "page.user.wantlist.title",
            defaultMessage: "User Wantlist",
          })}
        </h1>
        <p className="text-muted-foreground">
          {intl.formatMessage({
            id: "page.user.wantlist.description",
            defaultMessage: "Cards this user is looking for",
          })}
        </p>
      </div>

      <div className="space-y-6">
        <CardFilters
          onFilterChange={setFilters}
          disableSetFilter={false}
          availableCards={
            unfilteredWantlistData?.map((card) => ({
              setId: card.setId,
              rarity: card.rarity,
            })) ?? []
          }
        />

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : wantlistCards.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-lg font-semibold mb-2">
                {intl.formatMessage({
                  id: "page.user.wantlist.empty.title",
                  defaultMessage: "This user's wantlist is empty!",
                })}
              </h3>
              <p className="text-muted-foreground">
                {intl.formatMessage({
                  id: "page.user.wantlist.empty.description",
                  defaultMessage:
                    "This user has all cards in their custom sets!",
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
    </div>
  );
}
