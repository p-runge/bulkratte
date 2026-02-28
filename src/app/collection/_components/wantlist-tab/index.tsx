"use client";

import {
  CardFilters,
  type CardQuery,
} from "@/components/card-browser/card-filters";
import { UserCardGrid } from "@/components/card-browser/user-card-grid";
import Loader from "@/components/loader";
import { Card, CardContent } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/api/react";
import { Share2 } from "lucide-react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { ShareLinksDialog } from "./share-links-dialog";
import { Button } from "@/components/ui/button";

export default function WantlistTab() {
  const intl = useIntl();

  const [filters, setFilters] = useState<CardQuery>({
    setId: "",
    rarity: "",
    search: "",
    releaseDateFrom: "",
    releaseDateTo: "",
    sortBy: "set-and-number",
    sortOrder: "asc",
  });

  const { data: wantlistData, isLoading } = api.userCard.getWantlist.useQuery({
    setId: filters.setId && filters.setId !== "all" ? filters.setId : undefined,
    search: filters.search || undefined,
    rarity:
      filters.rarity && filters.rarity !== "all" ? filters.rarity : undefined,
    releaseDateFrom: filters.releaseDateFrom || undefined,
    releaseDateTo: filters.releaseDateTo || undefined,
    sortBy: filters.sortBy as "set-and-number" | "name" | "rarity" | "price",
    sortOrder: filters.sortOrder,
  });
  const wantlistCards = wantlistData ?? [];

  const { data: filterOptions } = api.card.getFilterOptions.useQuery();

  return (
    <TabsContent value="wantlist">
      <div className="space-y-6">
        <div className="flex justify-between items-start gap-4">
          <CardFilters
            onFilterChange={setFilters}
            filterOptions={filterOptions}
          />
          <ShareLinksDialog>
            <Button size="default" className="shrink-0">
              <Share2 className="h-4 w-4 mr-2" />
              {intl.formatMessage({
                id: "page.collection.wantlist.share",
                defaultMessage: "Share Wantlist",
              })}
            </Button>
          </ShareLinksDialog>
        </div>

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
          <UserCardGrid
            userCards={wantlistCards}
            selectionMode="single"
            selectedUserCardIds={new Set()}
            onUserCardClick={(userCard) => {
              console.log("Card clicked:", userCard.id);
            }}
            isLoading={isLoading}
          />
        )}
      </div>
    </TabsContent>
  );
}
