"use client";

import {
  CardFilters,
  DEFAULT_SORT_STATE,
  EMPTY_FILTER_STATE,
  type CardQuery,
} from "@/components/card-browser/card-filters";
import { UserCardGrid } from "@/components/card-browser/user-card-grid";
import Loader from "@/components/loader";
import { Card, CardContent } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/api/react";
import { Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { ShareLinksDialog } from "./share-links-dialog";
import { Button } from "@/components/ui/button";
import { filterAndSortCards } from "./filter-sort-client";

const CLIENT_SIDE_THRESHOLD = 500;

export default function WantlistTab() {
  const intl = useIntl();

  const [filters, setFilters] = useState<CardQuery>({
    ...EMPTY_FILTER_STATE,
    ...DEFAULT_SORT_STATE,
  });

  // Initial unfiltered fetch — limit to threshold+1 to detect large lists
  const { data: allData, isPending: isInitialPending } =
    api.userCard.getWantlist.useQuery({
      limit: CLIENT_SIDE_THRESHOLD + 1,
    });

  const isClientMode =
    allData !== undefined && allData.length <= CLIENT_SIDE_THRESHOLD;

  // Server-mode query — only active when list exceeds threshold
  const { data: serverFilteredData, isPending: isServerFilterPending } =
    api.userCard.getWantlist.useQuery(
      {
        setIds: filters.setIds.length > 0 ? filters.setIds : undefined,
        search: filters.search || undefined,
        rarities: filters.rarities.length > 0 ? filters.rarities : undefined,
        releaseDateFrom: filters.releaseDateFrom || undefined,
        releaseDateTo: filters.releaseDateTo || undefined,
        sortBy: filters.sortBy as
          | "set-and-number"
          | "name"
          | "rarity"
          | "price",
        sortOrder: filters.sortOrder,
      },
      { enabled: !isClientMode && allData !== undefined },
    );

  const { data: filterOptions } = api.card.getFilterOptions.useQuery();

  const displayCards = useMemo(() => {
    if (isClientMode && allData) {
      return filterAndSortCards(allData, filters);
    }
    return serverFilteredData ?? [];
  }, [isClientMode, allData, serverFilteredData, filters]);

  const isPending =
    isInitialPending ||
    (!isClientMode && isServerFilterPending && allData !== undefined);

  return (
    <TabsContent value="wantlist">
      <div className="space-y-6">
        <div className="flex justify-end">
          <ShareLinksDialog>
            <Button size="default">
              <Share2 className="h-4 w-4 mr-2" />
              {intl.formatMessage({
                id: "page.collection.wantlist.share",
                defaultMessage: "Share Wantlist",
              })}
            </Button>
          </ShareLinksDialog>
        </div>
        <CardFilters
          onFilterChange={setFilters}
          filterOptions={filterOptions}
        />

        {isPending ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : displayCards.length === 0 ? (
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
            userCards={displayCards}
            selectionMode="single"
            selectedUserCardIds={new Set()}
            onUserCardClick={(userCard) => {
              console.log("Card clicked:", userCard.id);
            }}
            isLoading={isPending}
          />
        )}
      </div>
    </TabsContent>
  );
}
