"use client";

import {
  CardFilters,
  type CardQuery,
} from "@/components/card-browser/card-filters";
import { UserCardGrid } from "@/components/card-browser/user-card-grid";
import Loader from "@/components/loader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api/react";
import { TRPCClientError } from "@trpc/client";
import { Camera, Clock, Lock } from "lucide-react";
import { use, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export default function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const intl = useIntl();

  const [collectionFilter, setCollectionFilter] = useState<
    "wantlist" | "in-collection" | "in-collection-not-in-sets"
  >("wantlist");

  const [filters, setFilters] = useState<CardQuery>({
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

  // Metadata: owner info, label, scope, expiry
  const {
    data: linkMeta,
    isLoading: isLoadingMeta,
    error: metaError,
  } = api.wantlistShareLink.getMetadata.useQuery({ token });

  // Wantlist cards for this token
  const { data: wantlistData, isLoading: isLoadingWantlist } =
    api.userCard.getSharedWantlist.useQuery(
      {
        token,
        setId:
          filters.setId && filters.setId !== "all" ? filters.setId : undefined,
        search: filters.search || undefined,
        rarity:
          filters.rarity && filters.rarity !== "all"
            ? filters.rarity
            : undefined,
        releaseDateFrom: filters.releaseDateFrom || undefined,
        releaseDateTo: filters.releaseDateTo || undefined,
        sortBy: filters.sortBy as
          | "set-and-number"
          | "name"
          | "rarity"
          | "price",
        sortOrder: filters.sortOrder,
      },
      { enabled: !metaError },
    );

  // Viewer's own collection (for the "cards I have" filter)
  const { data: viewerCollectionData, isLoading: isLoadingViewerCollection } =
    api.userCard.getList.useQuery(
      {},
      { enabled: isLoggedIn && collectionFilter !== "wantlist" },
    );

  const { data: placedUserCardIds } = api.userSet.getPlacedUserCardIds.useQuery(
    undefined,
    { enabled: isLoggedIn && collectionFilter === "in-collection-not-in-sets" },
  );

  const { data: filterOptions } = api.card.getFilterOptions.useQuery();

  const displayedCards = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cards = (wantlistData ?? []) as any[];

    if (collectionFilter === "wantlist" || !isLoggedIn) {
      return cards;
    }

    if (!viewerCollectionData) return cards;

    const viewerCardIdMap = new Map(
      viewerCollectionData.map((uc) => [uc.card.id, uc]),
    );

    if (collectionFilter === "in-collection") {
      return cards.filter((c) => viewerCardIdMap.has(c.cardId));
    }

    if (collectionFilter === "in-collection-not-in-sets") {
      const userCardIdsInSets = new Set(
        (placedUserCardIds ?? []).map((item) => item.userCardId),
      );
      return cards.filter((c) => {
        const uc = viewerCardIdMap.get(c.cardId);
        if (!uc) return false;
        return !userCardIdsInSets.has(uc.id);
      });
    }

    return cards;
  }, [
    collectionFilter,
    wantlistData,
    viewerCollectionData,
    placedUserCardIds,
    isLoggedIn,
  ]);

  const isLoading =
    isLoadingMeta ||
    isLoadingWantlist ||
    (collectionFilter !== "wantlist" && isLoadingViewerCollection);

  // Error states
  const isExpired =
    metaError instanceof TRPCClientError &&
    metaError.data?.code === "FORBIDDEN";
  const isNotFound =
    metaError instanceof TRPCClientError &&
    metaError.data?.code === "NOT_FOUND";

  if (isNotFound || (!isLoadingMeta && !linkMeta && !isExpired)) {
    return (
      <div className="container mx-auto py-16 flex flex-col items-center gap-6 text-center">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold mb-2">
            <FormattedMessage
              id="share.not-found.title"
              defaultMessage="Link not found"
            />
          </h1>
          <p className="text-muted-foreground">
            <FormattedMessage
              id="share.not-found.description"
              defaultMessage="This share link doesn't exist or has been revoked."
            />
          </p>
        </div>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="container mx-auto py-16 flex flex-col items-center gap-6 text-center">
        <Clock className="h-12 w-12 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold mb-2">
            <FormattedMessage
              id="share.expired.title"
              defaultMessage="Link expired"
            />
          </h1>
          <p className="text-muted-foreground">
            <FormattedMessage
              id="share.expired.description"
              defaultMessage="This share link has expired. Ask the owner to create a new one."
            />
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        {isLoadingMeta ? (
          <div className="h-16 flex items-center">
            <Loader />
          </div>
        ) : linkMeta ? (
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12 mt-1">
              <AvatarImage src={linkMeta.ownerImage ?? ""} />
              <AvatarFallback>
                {linkMeta.ownerName?.[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold">
                {linkMeta.label ??
                  intl.formatMessage(
                    {
                      id: "share.title.default",
                      defaultMessage: "{name}'s Wantlist",
                    },
                    { name: linkMeta.ownerName ?? "User" },
                  )}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {linkMeta.is_snapshot && (
                  <Badge variant="secondary" className="gap-1">
                    <Camera className="h-3 w-3" />
                    <FormattedMessage
                      id="share.badge.snapshot"
                      defaultMessage="Snapshot"
                    />
                  </Badge>
                )}
                {linkMeta.setNames && (
                  <Badge variant="outline">
                    <FormattedMessage
                      id="share.badge.scoped-sets"
                      defaultMessage="{count, plural, one {# set} other {# sets}}"
                      values={{ count: linkMeta.setNames.length }}
                    />
                  </Badge>
                )}
                {linkMeta.expires_at && (
                  <span className="text-xs text-muted-foreground">
                    <FormattedMessage
                      id="share.expires-at"
                      defaultMessage="Expires {date}"
                      values={{
                        date: new Date(
                          linkMeta.expires_at,
                        ).toLocaleDateString(),
                      }}
                    />
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-6">
        {/* Snapshot notice */}
        {linkMeta?.is_snapshot && (
          <Card className="border-dashed">
            <CardContent className="py-3 px-4 text-sm text-muted-foreground flex items-center gap-2">
              <Camera className="h-4 w-4 shrink-0" />
              <FormattedMessage
                id="share.snapshot.notice"
                defaultMessage="This is a snapshot taken on {date}. It shows the wantlist as it was at that moment."
                values={{
                  date: new Date(linkMeta.created_at).toLocaleDateString(),
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Viewer collection filter (only for logged-in users) */}
        {isLoggedIn && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              <FormattedMessage
                id="share.filter.collection.label"
                defaultMessage="Filter by your collection"
              />
            </h3>
            <ToggleGroup
              type="single"
              value={collectionFilter}
              onValueChange={(value) => {
                if (value)
                  setCollectionFilter(value as typeof collectionFilter);
              }}
              className="justify-start"
            >
              <ToggleGroupItem
                value="wantlist"
                variant="outline"
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <FormattedMessage
                  id="share.filter.collection.all"
                  defaultMessage="All wanted cards"
                />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="in-collection"
                variant="outline"
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <FormattedMessage
                  id="share.filter.collection.have"
                  defaultMessage="Only cards I have"
                />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="in-collection-not-in-sets"
                variant="outline"
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <FormattedMessage
                  id="share.filter.collection.have-free"
                  defaultMessage="Only cards I have that aren't in my sets"
                />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}

        {/* Card filters — hidden for snapshots (data is frozen, search is client-side) */}
        {!linkMeta?.is_snapshot && (
          <CardFilters
            onFilterChange={setFilters}
            filterOptions={filterOptions}
          />
        )}

        {/* Cards */}
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
                      id: "share.empty.title",
                      defaultMessage: "Wantlist is empty",
                    })
                  : intl.formatMessage({
                      id: "share.empty.filter.title",
                      defaultMessage: "No matching cards",
                    })}
              </h3>
              <p className="text-muted-foreground">
                {collectionFilter === "wantlist"
                  ? intl.formatMessage({
                      id: "share.empty.description",
                      defaultMessage: "This user has all the cards they need!",
                    })
                  : intl.formatMessage({
                      id: "share.empty.filter.description",
                      defaultMessage:
                        "You don't have any of the cards on this wantlist in your collection.",
                    })}
              </p>
            </CardContent>
          </Card>
        ) : (
          <UserCardGrid
            userCards={displayedCards}
            selectionMode="single"
            selectedUserCardIds={new Set()}
            onUserCardClick={() => {}}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}
