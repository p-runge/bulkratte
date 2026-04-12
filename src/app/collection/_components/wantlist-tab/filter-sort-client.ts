import type { CardQuery } from "@/components/card-browser/card-filters";
import type { RouterOutputs } from "@/lib/api/react";

type WantlistCard = RouterOutputs["userCard"]["getWantlist"][number];

export function filterAndSortCards(
  cards: WantlistCard[],
  query: CardQuery,
): WantlistCard[] {
  let result = cards;

  if (query.setIds.length > 0) {
    result = result.filter((c) => query.setIds.includes(c.card.setId));
  }

  if (query.rarities.length > 0) {
    result = result.filter(
      (c) => c.card.rarity !== null && query.rarities.includes(c.card.rarity),
    );
  }

  if (query.search) {
    const term = query.search.toLowerCase();
    result = result.filter(
      (c) =>
        c.card.name.toLowerCase().includes(term) ||
        c.card.number.toLowerCase().includes(term) ||
        (c.localizedName?.toLowerCase().includes(term) ?? false),
    );
  }

  if (query.releaseDateFrom) {
    result = result.filter(
      (c) =>
        c.card.setReleaseDate != null &&
        c.card.setReleaseDate >= query.releaseDateFrom,
    );
  }

  if (query.releaseDateTo) {
    result = result.filter(
      (c) =>
        c.card.setReleaseDate != null &&
        c.card.setReleaseDate <= query.releaseDateTo,
    );
  }

  const { sortBy, sortOrder } = query;
  const dir = sortOrder === "desc" ? -1 : 1;

  result = [...result].sort((a, b) => {
    switch (sortBy) {
      case "name": {
        const aName = a.localizedName ?? a.card.name;
        const bName = b.localizedName ?? b.card.name;
        return dir * aName.localeCompare(bName);
      }
      case "rarity": {
        const aRarity = a.card.rarity ?? "";
        const bRarity = b.card.rarity ?? "";
        return dir * aRarity.localeCompare(bRarity);
      }
      case "price": {
        const aPrice = a.card.price ?? 0;
        const bPrice = b.card.price ?? 0;
        return dir * (aPrice - bPrice);
      }
      case "set-and-number":
      default: {
        const aDate = a.card.setReleaseDate ?? "";
        const bDate = b.card.setReleaseDate ?? "";
        if (aDate !== bDate) return dir * aDate.localeCompare(bDate);
        const aNum = parseInt(a.card.number.replace(/\D/g, "") || "0", 10);
        const bNum = parseInt(b.card.number.replace(/\D/g, "") || "0", 10);
        return dir * (aNum - bNum);
      }
    }
  });

  return result;
}
