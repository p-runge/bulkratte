"use client";

import {
  CardFilters,
  DEFAULT_SORT_STATE,
  EMPTY_FILTER_STATE,
  type CardQuery,
} from "@/components/card-browser/card-filters";
import { UserCardGrid } from "@/components/card-browser/user-card-grid";
import Loader from "@/components/loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/lib/api/react";
import { Check, ClipboardList, Share2 } from "lucide-react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { ShareLinksDialog } from "./share-links-dialog";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  fr: "French",
  de: "German",
  it: "Italian",
  es: "Spanish",
  pt: "Portuguese",
};

function formatCardForCardmarket(
  card: {
    englishName: string;
    attacks: string[] | null;
    abilities: string[] | null;
  },
  language: string | null,
): string {
  const parts = ["1x", card.englishName];

  // Abilities come first (Poké-Power/Poké-Body appear before attacks on the card)
  if (card.abilities && card.abilities.length > 0) {
    parts.push(...card.abilities);
  }
  if (card.attacks && card.attacks.length > 0) {
    parts.push(...card.attacks);
  }

  if (language) {
    parts.push(LANGUAGE_NAMES[language ?? "en"] ?? "English");
  }

  return parts.join(" ");
}

export default function WantlistTab() {
  const intl = useIntl();

  const [filters, setFilters] = useState<CardQuery>({
    ...EMPTY_FILTER_STATE,
    ...DEFAULT_SORT_STATE,
  });
  const [copied, setCopied] = useState(false);

  const { data: wantlistData, isLoading } = api.userCard.getWantlist.useQuery({
    setIds: filters.setIds.length > 0 ? filters.setIds : undefined,
    search: filters.search || undefined,
    rarities: filters.rarities.length > 0 ? filters.rarities : undefined,
    releaseDateFrom: filters.releaseDateFrom || undefined,
    releaseDateTo: filters.releaseDateTo || undefined,
    sortBy: filters.sortBy as "set-and-number" | "name" | "rarity" | "price",
    sortOrder: filters.sortOrder,
  });
  const wantlistCards = wantlistData ?? [];

  const { data: filterOptions } = api.card.getFilterOptions.useQuery();

  async function handleCopyForCardmarket() {
    const lines = (
      wantlistCards as Array<{
        language: string | null;
        card: Parameters<typeof formatCardForCardmarket>[0];
      }>
    ).map((item) => formatCardForCardmarket(item.card, item.language));
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <TabsContent value="wantlist">
      <div className="space-y-6">
        <div className="flex justify-between items-start gap-4">
          <CardFilters
            onFilterChange={setFilters}
            filterOptions={filterOptions}
          />
          <div className="flex gap-2 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="default"
                  variant="outline"
                  onClick={handleCopyForCardmarket}
                  disabled={wantlistCards.length === 0}
                >
                  {copied ? (
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                  ) : (
                    <ClipboardList className="h-4 w-4 mr-2" />
                  )}
                  {copied
                    ? intl.formatMessage({
                        id: "page.collection.wantlist.copy_cardmarket.copied",
                        defaultMessage: "Copied!",
                      })
                    : intl.formatMessage({
                        id: "page.collection.wantlist.copy_cardmarket",
                        defaultMessage: "Copy for Cardmarket",
                      })}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {intl.formatMessage({
                  id: "page.collection.wantlist.copy_cardmarket.tooltip",
                  defaultMessage:
                    "Copies the current list as one card per line in Cardmarket's wantlist import format",
                })}
              </TooltipContent>
            </Tooltip>
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
