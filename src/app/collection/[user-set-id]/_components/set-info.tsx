"use client";

import { AppRouter } from "@/lib/api/routers/_app";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CalendarIcon, LayoutGridIcon } from "lucide-react";
import { FormattedMessage, FormattedDate } from "react-intl";
import { useMemo } from "react";
import { useBinderContext } from "@/components/binder/binder-context";
import pokemonAPI from "@/lib/pokemon-api";

type UserCard = Awaited<ReturnType<AppRouter["userCard"]["getList"]>>[number];

interface SetInfoProps {
  userCards: UserCard[];
}

export function SetInfo({ userCards }: SetInfoProps) {
  const {
    form,
    initialUserSet,
    considerPreferredLanguage = true,
    considerPreferredVariant = true,
    considerPreferredCondition = true,
    setConsiderPreferredLanguage,
    setConsiderPreferredVariant,
    setConsiderPreferredCondition,
  } = useBinderContext();

  const preferredLanguage = form.watch("preferredLanguage");
  const preferredVariant = form.watch("preferredVariant");
  const preferredCondition = form.watch("preferredCondition");

  const hasAnyPreferred =
    preferredLanguage || preferredVariant || preferredCondition;
  const { totalCards, placedCards, obtainedCards, obtainedButNotPlaced } =
    useMemo(() => {
      const totalCards = initialUserSet.cards.length;
      const placedCards = initialUserSet.cards.filter(
        (card) => card.userCardId !== null,
      ).length;

      // Get unique card IDs from the user set
      const userSetCardIds = new Set(
        initialUserSet.cards.map((card) => card.cardId),
      );

      // Get preferred properties from user set
      const preferredLanguage = initialUserSet.set.preferredLanguage;
      const preferredVariant = initialUserSet.set.preferredVariant;
      const preferredCondition = initialUserSet.set.preferredCondition;

      // Count how many of these cards the user has in their collection
      // Considering preferred properties if toggles are on
      const obtainedCardIds = new Set(
        userCards
          .filter((userCard) => {
            // Must match card ID
            if (!userSetCardIds.has(userCard.card.id)) return false;

            // Check preferred language if toggle is on
            if (considerPreferredLanguage && preferredLanguage) {
              if (userCard.language !== preferredLanguage) return false;
            }

            // Check preferred variant if toggle is on
            if (considerPreferredVariant && preferredVariant) {
              if (userCard.variant !== preferredVariant) return false;
            }

            // Check preferred condition if toggle is on (as minimum condition)
            if (considerPreferredCondition && preferredCondition) {
              if (
                !pokemonAPI.meetsMinimumCondition(
                  userCard.condition,
                  preferredCondition,
                )
              ) {
                return false;
              }
            }

            return true;
          })
          .map((userCard) => userCard.card.id),
      );

      const obtainedCards = obtainedCardIds.size;
      const obtainedButNotPlaced = obtainedCards - placedCards;

      return { totalCards, placedCards, obtainedCards, obtainedButNotPlaced };
    }, [
      initialUserSet,
      userCards,
      considerPreferredLanguage,
      considerPreferredVariant,
      considerPreferredCondition,
    ]);

  const placedPercentage =
    totalCards > 0 ? (placedCards / totalCards) * 100 : 0;
  const obtainedPercentage =
    totalCards > 0 ? (obtainedCards / totalCards) * 100 : 0;
  const obtainedButNotPlacedPercentage =
    totalCards > 0 ? (obtainedButNotPlaced / totalCards) * 100 : 0;

  return (
    <Card className="p-4 sm:p-6 mb-6">
      <div className="space-y-6">
        {/* Header with General Info */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-lg font-semibold">
            <FormattedMessage
              id="binder.info.title"
              defaultMessage="Set Information"
            />
          </h3>
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              <FormattedDate
                value={new Date(initialUserSet.set.createdAt)}
                year="numeric"
                month="short"
                day="numeric"
              />
            </span>
          </div>
        </div>

        {/* Progress Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">
              <FormattedMessage
                id="binder.info.progress.title"
                defaultMessage="Collection Progress"
              />
            </h4>
            <div className="flex items-center gap-2">
              <LayoutGridIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {obtainedCards}/{totalCards}
              </span>
            </div>
          </div>

          <Progress
            segments={[
              { value: obtainedPercentage, className: "bg-yellow-400" },
              { value: placedPercentage, className: "bg-green-600" },
            ]}
            className="h-2.5"
          />

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-green-600 shrink-0" />
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
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-yellow-400 shrink-0" />
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

        {/* Preferences */}
        {hasAnyPreferred && (
          <div className="space-y-3 pt-3 border-t">
            <h4 className="text-sm font-medium text-muted-foreground">
              <FormattedMessage
                id="binder.info.preferences.title"
                defaultMessage="Preferences"
              />
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              {preferredLanguage && setConsiderPreferredLanguage && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 border rounded-md bg-muted/30">
                  <Checkbox
                    id="considerPreferredLanguage"
                    checked={considerPreferredLanguage}
                    onCheckedChange={(checked) =>
                      setConsiderPreferredLanguage(!!checked)
                    }
                  />
                  <Label
                    htmlFor="considerPreferredLanguage"
                    className="font-normal cursor-pointer flex items-center gap-1.5 text-base leading-none"
                  >
                    {
                      pokemonAPI.cardLanguages.find(
                        (l) => l.code === preferredLanguage,
                      )?.flag
                    }
                  </Label>
                </div>
              )}

              {preferredVariant && setConsiderPreferredVariant && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 border rounded-md bg-muted/30">
                  <Checkbox
                    id="considerPreferredVariant"
                    checked={considerPreferredVariant}
                    onCheckedChange={(checked) =>
                      setConsiderPreferredVariant(!!checked)
                    }
                  />
                  <Label
                    htmlFor="considerPreferredVariant"
                    className="text-sm font-normal cursor-pointer leading-none"
                  >
                    <Badge variant="outline" className="text-xs font-medium">
                      {preferredVariant}
                    </Badge>
                  </Label>
                </div>
              )}

              {preferredCondition && setConsiderPreferredCondition && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 border rounded-md bg-muted/30">
                  <Checkbox
                    id="considerPreferredCondition"
                    checked={considerPreferredCondition}
                    onCheckedChange={(checked) =>
                      setConsiderPreferredCondition(!!checked)
                    }
                  />
                  <Label
                    htmlFor="considerPreferredCondition"
                    className="text-sm font-normal cursor-pointer leading-none"
                  >
                    <Badge
                      className={`${
                        pokemonAPI.conditions.find(
                          (c) => c.value === preferredCondition,
                        )?.color || "bg-gray-500"
                      } border text-xs font-medium`}
                    >
                      {pokemonAPI.conditions.find(
                        (c) => c.value === preferredCondition,
                      )?.short || preferredCondition}
                    </Badge>
                  </Label>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
