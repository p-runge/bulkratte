"use client";

import {
  CardFilters,
  type CardQuery,
} from "@/components/card-browser/card-filters";
import { UserCardGrid } from "@/components/card-browser/user-card-grid";
import Loader from "@/components/loader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api/react";
import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import { use, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

const defaultFilters: CardQuery = {
  setId: "",
  rarity: "",
  search: "",
  releaseDateFrom: "",
  releaseDateTo: "",
  sortBy: "set-and-number",
  sortOrder: "asc",
};

function buildQueryArgs(filters: CardQuery) {
  return {
    setId: filters.setId && filters.setId !== "all" ? filters.setId : undefined,
    search: filters.search || undefined,
    rarity:
      filters.rarity && filters.rarity !== "all" ? filters.rarity : undefined,
    releaseDateFrom: filters.releaseDateFrom || undefined,
    releaseDateTo: filters.releaseDateTo || undefined,
    sortBy: filters.sortBy as "set-and-number" | "name" | "rarity" | "price",
    sortOrder: filters.sortOrder,
  };
}

export default function TradeOverlapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const intl = useIntl();

  const [theirFilters, setTheirFilters] = useState<CardQuery>(defaultFilters);
  const [myFilters, setMyFilters] = useState<CardQuery>(defaultFilters);
  const [theirView, setTheirView] = useState<"all" | "can-give">("all");

  const { data: currentUser, isLoading: isLoadingUser } =
    api.getCurrentUser.useQuery(undefined, { retry: false });

  const {
    data: connection,
    isLoading: isLoadingConn,
    error: connError,
  } = api.tradeConnection.get.useQuery({ id }, { enabled: !!currentUser });

  const partnerToken = connection?.viewPartnerToken ?? null;

  const { data: theirWantlistData, isLoading: isLoadingTheirs } =
    api.userCard.getSharedWantlist.useQuery(
      { token: partnerToken!, ...buildQueryArgs(theirFilters) },
      { enabled: !!partnerToken },
    );

  const { data: myWantlistData, isLoading: isLoadingMine } =
    api.userCard.getWantlist.useQuery(buildQueryArgs(myFilters));

  // My full collection for computing overlaps (no filters)
  const { data: myCollectionData } = api.userCard.getList.useQuery({});

  // TCG card IDs that I own (for overlap matching)
  const myTcgCardIds = useMemo(() => {
    if (!myCollectionData) return new Set<string>();
    return new Set<string>(
      (myCollectionData as any[]).map((c: any) => c.card?.id).filter(Boolean),
    );
  }, [myCollectionData]);

  const theirCards = useMemo(
    () => (theirWantlistData ?? []) as any[],
    [theirWantlistData],
  );

  // UserCard IDs from the partner's wantlist that I can give (TCG card matches my collection)
  const matchingUserCardIds = useMemo(() => {
    return new Set<string>(
      theirCards
        .filter((c: any) => myTcgCardIds.has(c.card?.id))
        .map((c: any) => c.id),
    );
  }, [theirCards, myTcgCardIds]);

  const filteredTheirCards = useMemo(() => {
    if (theirView === "can-give") {
      return theirCards.filter((c: any) => matchingUserCardIds.has(c.id));
    }
    return theirCards;
  }, [theirCards, theirView, matchingUserCardIds]);

  const canGiveCount = matchingUserCardIds.size;

  const myCards = useMemo(
    () => (myWantlistData ?? []) as any[],
    [myWantlistData],
  );

  if (isLoadingUser || isLoadingConn) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-muted-foreground">
        <Lock className="h-12 w-12" />
        <p className="text-lg font-medium">
          <FormattedMessage
            id="trade.overlap.signInRequired"
            defaultMessage="Please sign in to view this page."
          />
        </p>
      </div>
    );
  }

  if (connError) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-muted-foreground">
        <Lock className="h-12 w-12" />
        <p className="text-lg font-medium">
          <FormattedMessage
            id="trade.overlap.notFound"
            defaultMessage="This trade connection was not found or you don't have access."
          />
        </p>
        <Button variant="outline" asChild>
          <Link href="/trade">
            <ArrowLeft className="mr-2 h-4 w-4" />
            <FormattedMessage
              id="trade.overlap.back"
              defaultMessage="Back to trades"
            />
          </Link>
        </Button>
      </div>
    );
  }

  if (!connection) return null;

  const partner = connection.partner;
  const partnerInitials = partner?.name
    ? partner.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/trade">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={partner?.image ?? undefined} />
            <AvatarFallback>{partnerInitials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-semibold">
              <FormattedMessage
                id="trade.overlap.title"
                defaultMessage="Trade with {name}"
                values={{ name: partner?.name ?? "Partner" }}
              />
            </h1>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="theirs">
        <TabsList>
          <TabsTrigger value="theirs">
            <FormattedMessage
              id="trade.overlap.partnersWantlist"
              defaultMessage="Partner's wantlist"
            />
            {canGiveCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {canGiveCount}{" "}
                <FormattedMessage
                  id="trade.overlap.canGiveSuffix"
                  defaultMessage="match"
                />
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="mine">
            <FormattedMessage
              id="trade.overlap.myWantlist"
              defaultMessage="My wantlist"
            />
          </TabsTrigger>
        </TabsList>

        {/* Their wantlist tab */}
        <TabsContent value="theirs" className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <ToggleGroup
              type="single"
              value={theirView}
              onValueChange={(v) => {
                if (v) setTheirView(v as "all" | "can-give");
              }}
            >
              <ToggleGroupItem value="all">
                <FormattedMessage
                  id="trade.overlap.showAll"
                  defaultMessage="All"
                />
              </ToggleGroupItem>
              <ToggleGroupItem value="can-give">
                <FormattedMessage
                  id="trade.overlap.canGive"
                  defaultMessage="Cards I can give"
                />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <CardFilters onFilterChange={setTheirFilters} />

          {isLoadingTheirs ? (
            <div className="flex min-h-32 items-center justify-center">
              <Loader />
            </div>
          ) : (
            <UserCardGrid
              userCards={filteredTheirCards}
              selectionMode="single"
              selectedUserCardIds={matchingUserCardIds}
              onUserCardClick={() => {}}
              isLoading={false}
            />
          )}
        </TabsContent>

        {/* My wantlist tab */}
        <TabsContent value="mine" className="space-y-4">
          <CardFilters onFilterChange={setMyFilters} />

          {isLoadingMine ? (
            <div className="flex min-h-32 items-center justify-center">
              <Loader />
            </div>
          ) : (
            <UserCardGrid
              userCards={myCards}
              selectionMode="single"
              selectedUserCardIds={new Set()}
              onUserCardClick={() => {}}
              isLoading={false}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
