"use client";

import type { UserCard } from "@/components/binder/types";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import pokemonAPI from "@/lib/pokemon-api";
import { cn } from "@/lib/utils";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Circle } from "lucide-react";
import Image from "next/image";
import { FormattedMessage, useIntl } from "react-intl";
import Loader from "../loader";

type UserCardGridProps = {
  userCards: UserCard[];
  selectionMode: "single" | "multi";
  selectedUserCardIds: Set<string>;
  onUserCardClick: (userCard: UserCard) => void;
  onSelectAll?: (selectAll: boolean) => void;
  isLoading: boolean;
  maxHeight?: string;
};

export function UserCardGrid({
  userCards,
  selectionMode,
  selectedUserCardIds,
  onUserCardClick,
  onSelectAll,
  isLoading,
  maxHeight,
}: UserCardGridProps) {
  const intl = useIntl();
  const [parent] = useAutoAnimate();

  const allSelected =
    userCards.length > 0 &&
    userCards.every((userCard) => selectedUserCardIds.has(userCard.id));
  const someSelected = userCards.some((userCard) =>
    selectedUserCardIds.has(userCard.id),
  );

  const handleSelectAllChange = () => {
    if (onSelectAll) {
      onSelectAll(!allSelected);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center">
        <Loader />
      </div>
    );
  }

  if (userCards.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <FormattedMessage
          id="card.browser.empty"
          defaultMessage="No cards found. Try adjusting your filters."
        />
      </div>
    );
  }

  return (
    <div
      className="space-y-4 overflow-y-auto"
      style={{
        maxHeight,
      }}
    >
      {selectionMode === "multi" && onSelectAll && userCards.length > 0 && (
        <div className="flex items-center gap-2 pb-2 border-b">
          <Checkbox
            checked={allSelected}
            data-state={
              someSelected && !allSelected
                ? "indeterminate"
                : allSelected
                  ? "checked"
                  : "unchecked"
            }
            onCheckedChange={handleSelectAllChange}
            id="select-all"
          />
          <label
            htmlFor="select-all"
            className="text-sm font-medium cursor-pointer select-none"
          >
            <FormattedMessage
              id="card.browser.selectAll"
              defaultMessage="Select all ({count})"
              values={{ count: userCards.length }}
            />
          </label>
        </div>
      )}
      <div
        ref={parent}
        className="gap-4"
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fill, minmax(clamp(120px, 20vw, 245px), 1fr))",
        }}
      >
        {userCards.map((userCard) => {
          const isSelected = selectedUserCardIds.has(userCard.id);
          const selectionIndex = isSelected
            ? Array.from(selectedUserCardIds).indexOf(userCard.id) + 1
            : 0;
          return (
            <button
              key={userCard.id}
              onClick={() => onUserCardClick(userCard)}
              className={cn(
                "group relative rounded-lg overflow-hidden transition-all hover:scale-105",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
                isSelected && "ring-2 ring-primary",
                "w-full",
              )}
            >
              <div className="aspect-245/337 relative">
                <Image
                  src={userCard.card.imageSmall || "/placeholder.svg"}
                  width="245"
                  height="337"
                  unoptimized
                  alt={`${userCard.card.name} - ${userCard.card.number}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {isSelected && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <div className="bg-primary rounded-full border-black border w-10 h-10 flex items-center justify-center">
                      {selectionMode === "multi" ? (
                        <span className="text-lg font-bold text-primary-foreground">
                          {selectionIndex}
                        </span>
                      ) : (
                        <Circle className="h-6 w-6 text-primary-foreground fill-current" />
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* User card details overlay */}
              <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                {userCard.variant && (
                  <Badge className="text-xs bg-black/70 text-white border-none">
                    {userCard.variant}
                  </Badge>
                )}
                {userCard.language && (
                  <Badge
                    className="text-lg bg-black/70 text-white border-none px-1.5 py-0.5"
                    title={
                      pokemonAPI.cardLanguages.find(
                        (l) => l.code === userCard.language,
                      )?.name
                    }
                  >
                    {pokemonAPI.cardLanguages.find(
                      (l) => l.code === userCard.language,
                    )?.flag || userCard.language.toUpperCase()}
                  </Badge>
                )}
                {userCard.condition && (
                  <Badge
                    className={`${pokemonAPI.conditions.find((c) => c.value === userCard.condition)?.color || "bg-gray-500 text-white"} border text-xs`}
                    title={userCard.condition}
                  >
                    {pokemonAPI.conditions.find(
                      (c) => c.value === userCard.condition,
                    )?.short || userCard.condition}
                  </Badge>
                )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-2">
                <p className="text-xs text-white font-medium truncate">
                  {userCard.card.number} - {userCard.card.name}
                </p>
                <p className="text-xs text-white/70">
                  {userCard.card.price !== undefined &&
                    `${intl.formatNumber(userCard.card.price / 100, { style: "currency", currency: "EUR" })} (avg. 7d)`}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* // TODO: add pagination here */}
    </div>
  );
}
