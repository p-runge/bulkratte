"use client";

import {
  CardFilters,
  type CardQuery,
} from "@/components/card-browser/card-filters";
import { UserCardGrid } from "@/components/card-browser/user-card-grid";
import Loader from "@/components/loader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api/react";
import { Lock } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export default function UserWantlistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
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

  const { data: currentUser, isLoading: isLoadingUser } =
    api.getCurrentUser.useQuery(undefined, { retry: false });

  const isOwnWantlist = currentUser?.id === id;

  const { data: wantlistData, isLoading: isLoadingWantlist } =
    api.userCard.getWantlist.useQuery(
      {
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
      { enabled: isOwnWantlist },
    );

  const { data: filterOptions } = api.card.getFilterOptions.useQuery();

  const isLoading = isLoadingUser || (isOwnWantlist && isLoadingWantlist);

  // Not logged in or viewing someone else's wantlist
  if (!isLoadingUser && !isOwnWantlist) {
    return (
      <div className="container mx-auto py-16 flex flex-col items-center gap-6 text-center">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold mb-2">
            <FormattedMessage
              id="page.user.wantlist.private.title"
              defaultMessage="This wantlist is private"
            />
          </h1>
          <p className="text-muted-foreground max-w-md">
            <FormattedMessage
              id="page.user.wantlist.private.description"
              defaultMessage="This user's wantlist is only accessible via a share link. Ask them to share one with you."
            />
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {intl.formatMessage({
              id: "page.user.wantlist.title",
              defaultMessage: "My Wantlist",
            })}
          </h1>
          <p className="text-muted-foreground">
            {intl.formatMessage({
              id: "page.user.wantlist.description",
              defaultMessage: "Cards you still need to complete your sets.",
            })}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/collection?tab=wantlist">
            <FormattedMessage
              id="page.user.wantlist.manage-links"
              defaultMessage="Manage share links"
            />
          </Link>
        </Button>
      </div>

      <div className="space-y-6">
        <Alert>
          <AlertTitle>
            <FormattedMessage
              id="page.user.wantlist.own-wantlist.title"
              defaultMessage="This is your private wantlist"
            />
          </AlertTitle>
          <AlertDescription>
            <FormattedMessage
              id="page.user.wantlist.own-wantlist.description"
              defaultMessage="Only you can see this page. Use share links to give others access to your wantlist."
            />
          </AlertDescription>
        </Alert>

        <CardFilters
          onFilterChange={setFilters}
          filterOptions={filterOptions}
        />

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : !wantlistData || wantlistData.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-lg font-semibold mb-2">
                {intl.formatMessage({
                  id: "page.user.wantlist.empty.title",
                  defaultMessage: "Your wantlist is empty!",
                })}
              </h3>
              <p className="text-muted-foreground">
                {intl.formatMessage({
                  id: "page.user.wantlist.empty.description",
                  defaultMessage: "You have all cards in your custom sets!",
                })}
              </p>
            </CardContent>
          </Card>
        ) : (
          <UserCardGrid
            userCards={wantlistData}
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
