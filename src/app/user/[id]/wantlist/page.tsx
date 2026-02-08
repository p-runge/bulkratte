"use client";

import {
  CardFilters,
  type FilterState,
} from "@/components/card-browser/card-filters";
import { UserCardGrid } from "@/components/card-browser/user-card-grid";
import Loader from "@/components/loader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api/react";
import { use, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export default function UserWantlistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const intl = useIntl();

  const [collectionFilter, setCollectionFilter] = useState<
    "wantlist" | "in-collection" | "in-collection-not-in-sets"
  >("wantlist");

  const [filters, setFilters] = useState<FilterState>({
    setId: "",
    rarity: "",
    search: "",
    releaseDateFrom: "",
    releaseDateTo: "",
    sortBy: "set-and-number",
    sortOrder: "asc",
  });

  const { data: currentUser } = api.getCurrentUser.useQuery(undefined, {
    retry: false,
  });

  const isLoggedIn = !!currentUser;
  const isOwnWantlist = currentUser?.id === id;

  // Always fetch User A's wantlist (the person whose wantlist we're viewing)
  const { data: wantlistData, isLoading: isLoadingWantlist } =
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

  // Fetch User B's collection (the logged-in user viewing the page)
  // Only fetch if logged in and filtering by collection
  const { data: viewerCollectionData, isLoading: isLoadingViewerCollection } =
    api.userCard.getList.useQuery(
      {
        // Don't apply filters here, we'll filter the wantlist instead
      },
      { enabled: isLoggedIn && collectionFilter !== "wantlist" },
    );

  // Get IDs of user cards that are placed in User B's user sets
  const { data: placedUserCardIds } = api.userSet.getPlacedUserCardIds.useQuery(
    undefined,
    { enabled: isLoggedIn && collectionFilter === "in-collection-not-in-sets" },
  );

  const { data: filterOptions } = api.card.getFilterOptions.useQuery();

  const displayedCards = useMemo(() => {
    if (!wantlistData) return [];

    if (collectionFilter === "wantlist") {
      // Show all cards User A wants
      return wantlistData;
    }

    if (!viewerCollectionData) return [];

    // Create a map of User B's card IDs for quick lookup
    const viewerCardIdMap = new Map(
      viewerCollectionData.map((uc) => [uc.card.id, uc]),
    );

    if (collectionFilter === "in-collection") {
      // Show cards User A wants that User B also has
      return wantlistData.filter(
        (wantlistCard: (typeof wantlistData)[number]) =>
          viewerCardIdMap.has(wantlistCard.cardId),
      );
    }

    if (collectionFilter === "in-collection-not-in-sets") {
      // Show cards User A wants that User B has but are NOT in User B's sets
      // Get set of user card IDs that are placed in User B's sets
      const userCardIdsInSets = new Set(
        (placedUserCardIds ?? []).map((item) => item.userCardId),
      );

      return wantlistData.filter(
        (wantlistCard: (typeof wantlistData)[number]) => {
          const userCard = viewerCardIdMap.get(wantlistCard.cardId);
          if (!userCard) return false;
          // Show only if this user card is NOT placed in any set
          return !userCardIdsInSets.has(userCard.id);
        },
      );
    }

    return wantlistData;
  }, [collectionFilter, wantlistData, viewerCollectionData, placedUserCardIds]);

  const isLoading = isLoadingWantlist || isLoadingViewerCollection;

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
        {isOwnWantlist && (
          <Alert>
            <AlertTitle>
              <FormattedMessage
                id="page.user.wantlist.own-wantlist.title"
                defaultMessage="This is your wantlist"
              />
            </AlertTitle>
            <AlertDescription>
              <FormattedMessage
                id="page.user.wantlist.own-wantlist.description"
                defaultMessage="You are viewing your own wantlist. These are cards you need to complete your sets."
              />
            </AlertDescription>
          </Alert>
        )}

        {isLoggedIn && !isOwnWantlist && (
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">
              <FormattedMessage
                id="page.user.wantlist.filter.collection.label"
                defaultMessage="Show"
              />
            </h3>
            <ToggleGroup
              type="single"
              value={collectionFilter}
              onValueChange={(value) => {
                if (value) {
                  setCollectionFilter(
                    value as
                      | "wantlist"
                      | "in-collection"
                      | "in-collection-not-in-sets",
                  );
                }
              }}
              className="justify-start"
            >
              <ToggleGroupItem
                value="wantlist"
                variant="outline"
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <FormattedMessage
                  id="page.user.wantlist.filter.collection.wantlist"
                  defaultMessage="All cards"
                />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="in-collection"
                variant="outline"
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <FormattedMessage
                  id="page.user.wantlist.filter.collection.in-collection"
                  defaultMessage="Only cards I have"
                />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="in-collection-not-in-sets"
                variant="outline"
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <FormattedMessage
                  id="page.user.wantlist.filter.collection.in-collection-not-in-sets"
                  defaultMessage="Only cards I have that aren't in my sets"
                />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}

        <CardFilters
          onFilterChange={setFilters}
          filterOptions={filterOptions}
        />

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : displayedCards.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-lg font-semibold mb-2">
                {collectionFilter === "wantlist"
                  ? intl.formatMessage({
                      id: "page.user.wantlist.empty.title",
                      defaultMessage: "This user's wantlist is empty!",
                    })
                  : collectionFilter === "in-collection"
                    ? intl.formatMessage({
                        id: "page.user.wantlist.empty.in-collection.title",
                        defaultMessage: "No matching cards found",
                      })
                    : intl.formatMessage({
                        id: "page.user.wantlist.empty.in-collection-not-in-sets.title",
                        defaultMessage: "No matching cards found",
                      })}
              </h3>
              <p className="text-muted-foreground">
                {collectionFilter === "wantlist"
                  ? intl.formatMessage({
                      id: "page.user.wantlist.empty.description",
                      defaultMessage:
                        "This user has all cards in their custom sets!",
                    })
                  : collectionFilter === "in-collection"
                    ? intl.formatMessage({
                        id: "page.user.wantlist.empty.in-collection.description",
                        defaultMessage:
                          "You don't have any cards this user needs in your collection.",
                      })
                    : intl.formatMessage({
                        id: "page.user.wantlist.empty.in-collection-not-in-sets.description",
                        defaultMessage:
                          "You don't have any cards this user needs that aren't already in your sets.",
                      })}
              </p>
            </CardContent>
          </Card>
        ) : (
          <UserCardGrid
            userCards={displayedCards}
            selectionMode="single"
            selectedUserCardIds={new Set()}
            onUserCardClick={(userCard) => {
              console.log("Card clicked:", userCard.id);
            }}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}
