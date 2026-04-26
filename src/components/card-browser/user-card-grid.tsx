"use client";

import type { UserCard } from "@/components/binder/types";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CARD_ASPECT_CLASS,
  CARD_BORDER_RADIUS,
  CARD_IMAGE_HEIGHT,
  CARD_IMAGE_WIDTH,
} from "@/lib/card-config";
import pokemonAPI from "@/lib/pokemon-api";
import { cn } from "@/lib/utils";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Circle } from "lucide-react";
import Image from "next/image";
import { FormattedMessage, useIntl } from "react-intl";
import Loader from "../loader";
import type { CardBrowserView } from "@/providers/ui-preferences-provider";

type UserCardGridProps = {
  userCards: UserCard[];
  selectionMode: "single" | "multi";
  selectedUserCardIds: Set<string>;
  onUserCardClick: (userCard: UserCard) => void;
  onSelectAll?: (selectAll: boolean) => void;
  isLoading: boolean;
  maxHeight?: string;
  view?: CardBrowserView;
};

export function UserCardGrid({
  userCards,
  selectionMode,
  selectedUserCardIds,
  onUserCardClick,
  onSelectAll,
  isLoading,
  maxHeight,
  view = "grid",
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

      {view === "grid" ? (
        <div
          ref={parent}
          className="gap-4"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(clamp(120px, 20vw, ${CARD_IMAGE_WIDTH}px), 1fr))`,
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
                  "cursor-pointer group relative overflow-hidden transition-all hover:scale-105",
                  "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
                  isSelected && "ring-2 ring-primary",
                  "w-full",
                )}
                style={{ borderRadius: CARD_BORDER_RADIUS }}
              >
                <div className={`${CARD_ASPECT_CLASS} relative`}>
                  <Image
                    src={userCard.card.image || "/placeholder.svg"}
                    width={CARD_IMAGE_WIDTH}
                    height={CARD_IMAGE_HEIGHT}
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
                  {userCard.variant && (
                    <Badge className="text-xs bg-black/70 text-white border-none">
                      {userCard.variant}
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
      ) : (
        <div ref={parent} className="flex flex-col divide-y">
          {userCards.map((userCard) => {
            const isSelected = selectedUserCardIds.has(userCard.id);
            const selectionIndex = isSelected
              ? Array.from(selectedUserCardIds).indexOf(userCard.id) + 1
              : 0;
            const lang = pokemonAPI.cardLanguages.find(
              (l) => l.code === userCard.language,
            );
            const cond = pokemonAPI.conditions.find(
              (c) => c.value === userCard.condition,
            );
            return (
              <button
                key={userCard.id}
                onClick={() => onUserCardClick(userCard)}
                className={cn(
                  "flex items-center gap-3 py-2 px-1 text-left transition-colors hover:bg-muted/50 rounded-sm",
                  "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset",
                  isSelected && "bg-primary/10",
                )}
              >
                {/* Selection indicator */}
                <div className="shrink-0 w-6 flex justify-center">
                  {isSelected ? (
                    <div className="bg-primary rounded-full w-6 h-6 flex items-center justify-center">
                      {selectionMode === "multi" ? (
                        <span className="text-xs font-bold text-primary-foreground">
                          {selectionIndex}
                        </span>
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-primary-foreground fill-current" />
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Card thumbnail */}
                <div
                  className="shrink-0 w-9 h-[50px] overflow-hidden relative"
                  style={{ borderRadius: CARD_BORDER_RADIUS }}
                >
                  <Image
                    src={userCard.card.image || "/placeholder.svg"}
                    width="36"
                    height="50"
                    unoptimized
                    alt={`${userCard.card.name} - ${userCard.card.number}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* Number */}
                <span className="shrink-0 w-12 text-xs text-muted-foreground tabular-nums">
                  {userCard.card.number}
                </span>

                {/* Name */}
                <span className="flex-1 min-w-0 text-sm font-medium truncate">
                  {userCard.card.name}
                </span>

                {/* Condition badge */}
                {cond ? (
                  <Badge
                    className={`hidden sm:flex shrink-0 text-xs border ${cond.color}`}
                    title={userCard.condition ?? undefined}
                  >
                    {cond.short}
                  </Badge>
                ) : (
                  <span className="hidden sm:block shrink-0 w-8" />
                )}

                {/* Language */}
                <span
                  className="hidden sm:block shrink-0 text-sm w-6 text-center"
                  title={lang?.name ?? userCard.language ?? undefined}
                >
                  {lang?.flag ??
                    (userCard.language ? userCard.language.toUpperCase() : "—")}
                </span>

                {/* Variant */}
                <span className="hidden md:block shrink-0 text-xs text-muted-foreground w-16 truncate text-right">
                  {userCard.variant ?? "—"}
                </span>

                {/* Price */}
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground w-20 text-right">
                  {userCard.card.price !== undefined
                    ? intl.formatNumber(userCard.card.price / 100, {
                        style: "currency",
                        currency: "EUR",
                      })
                    : "—"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* // TODO: add pagination here */}
    </div>
  );
}
