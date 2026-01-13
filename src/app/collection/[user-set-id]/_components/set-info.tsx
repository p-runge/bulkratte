"use client";

import { AppRouter } from "@/lib/api/routers/_app";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalendarIcon, LayoutGridIcon } from "lucide-react";
import { FormattedMessage, FormattedDate } from "react-intl";
import { useMemo } from "react";

type UserSet = Awaited<ReturnType<AppRouter["userSet"]["getById"]>>;
type UserCard = Awaited<ReturnType<AppRouter["userCard"]["getList"]>>[number];

interface SetInfoProps {
  userSet: UserSet;
  userCards: UserCard[];
}

export function SetInfo({ userSet, userCards }: SetInfoProps) {
  const { totalCards, placedCards, obtainedCards, obtainedButNotPlaced } =
    useMemo(() => {
      const totalCards = userSet.cards.length;
      const placedCards = userSet.cards.filter(
        (card) => card.userCardId !== null,
      ).length;

      // Get unique card IDs from the user set
      const userSetCardIds = new Set(userSet.cards.map((card) => card.cardId));

      // Count how many of these cards the user has in their collection
      const obtainedCardIds = new Set(
        userCards
          .filter((userCard) => userSetCardIds.has(userCard.cardId))
          .map((userCard) => userCard.cardId),
      );

      const obtainedCards = obtainedCardIds.size;
      const obtainedButNotPlaced = obtainedCards - placedCards;

      return { totalCards, placedCards, obtainedCards, obtainedButNotPlaced };
    }, [userSet, userCards]);

  const placedPercentage =
    totalCards > 0 ? (placedCards / totalCards) * 100 : 0;
  const obtainedPercentage =
    totalCards > 0 ? (obtainedCards / totalCards) * 100 : 0;
  const obtainedButNotPlacedPercentage =
    totalCards > 0 ? (obtainedButNotPlaced / totalCards) * 100 : 0;

  return (
    <Card className="p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* General Info */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mb-3">
            <FormattedMessage
              id="binder.info.title"
              defaultMessage="Set Information"
            />
          </h3>

          <div className="flex items-center gap-3 text-sm">
            <LayoutGridIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              <FormattedMessage
                id="binder.info.total.cards"
                defaultMessage="Total Cards:"
              />
            </span>
            <span className="font-medium">{totalCards}</span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              <FormattedMessage
                id="binder.info.created.at"
                defaultMessage="Created on:"
              />
            </span>
            <span className="font-medium">
              <FormattedDate
                value={new Date(userSet.set.createdAt)}
                year="numeric"
                month="numeric"
                day="numeric"
              />
            </span>
          </div>
        </div>

        {/* Progress Info */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mb-3">
            <FormattedMessage
              id="binder.info.progress.title"
              defaultMessage="Collection Progress"
            />
          </h3>

          {/* Combined Progress Bar */}
          <div className="space-y-2">
            <Progress
              segments={[
                { value: obtainedPercentage, className: "bg-yellow-400" },
                { value: placedPercentage, className: "bg-green-600" },
              ]}
              className="h-3"
            />
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-green-600" />
                  <span className="text-muted-foreground">
                    <FormattedMessage
                      id="binder.info.progress.placed"
                      defaultMessage="Placed in Binder"
                    />
                  </span>
                  <span className="font-medium">
                    {placedCards} ({placedPercentage.toFixed(1)}%)
                  </span>
                </div>
                {obtainedButNotPlaced > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-yellow-400" />
                    <span className="text-muted-foreground">
                      <FormattedMessage
                        id="binder.info.progress.obtained"
                        defaultMessage="Obtained but not placed"
                      />
                    </span>
                    <span className="font-medium">
                      {obtainedButNotPlaced} (
                      {obtainedButNotPlacedPercentage.toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
