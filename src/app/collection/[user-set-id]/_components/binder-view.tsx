"use client";

import { CardImageDialog } from "@/components/card-image";
import { AppRouter } from "@/lib/api/routers/_app";
import { cn } from "@/lib/utils";
import Image from "next/image";

type UserSet = Awaited<ReturnType<AppRouter["userSet"]["getById"]>>;
type UserCard = Awaited<ReturnType<AppRouter["userCard"]["getList"]>>[number];

interface BinderViewProps {
  userSet: UserSet;
  userCards: UserCard[];
  onCardClick: (userSetCardId: string, cardId: string, hasUserCard: boolean, isPlaced: boolean, currentUserCardId: string | null) => void;
}

interface BinderCardProps {
  cardData: UserSet["cards"][number] | null;
  userCardsByCardId: Record<string, UserCard[]>;
  onCardClick: (userSetCardId: string, cardId: string, hasUserCard: boolean, isPlaced: boolean, currentUserCardId: string | null) => void;
}

function BinderCard({ cardData, userCardsByCardId, onCardClick }: BinderCardProps) {
  if (!cardData || !cardData.card) {
    // Empty slot
    return (
      <div className="aspect-[2.5/3.5] bg-muted/30 rounded border-2 border-dashed border-muted-foreground/20" />
    );
  }

  const { id: userSetCardId, cardId, userCardId, card } = cardData;
  const isPlaced = !!userCardId;
  const hasUserCard = (userCardsByCardId[cardId]?.length ?? 0) > 0;

  return (
    <button
      onClick={() => onCardClick(userSetCardId, cardId, hasUserCard, isPlaced, userCardId)}
      className={cn(
        "aspect-[2.5/3.5] rounded relative transition-all hover:scale-105",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        !isPlaced && "opacity-40 grayscale",
        hasUserCard && !isPlaced && "ring-2 ring-yellow-500"
      )}
    >
      <Image
        src={card.imageSmall}
        alt={card.name}
        width={200}
        height={280}
        unoptimized
        className="w-full h-full object-contain rounded"
      />
    </button>
  );
}

const CARDS_PER_PAGE = 9; // 3x3 grid
const PAGES_VISIBLE = 2; // Show 2 pages side by side

export function BinderView({ userSet, userCards, onCardClick }: BinderViewProps) {
  // Create a map of card_id to user cards for quick lookup
  const userCardsByCardId = userCards.reduce((acc, userCard) => {
    if (!acc[userCard.cardId]) {
      acc[userCard.cardId] = [];
    }
    acc[userCard.cardId]!.push(userCard);
    return acc;
  }, {} as Record<string, UserCard[]>);

  // Split cards into pages
  const totalPages = Math.ceil(userSet.cards.length / CARDS_PER_PAGE);
  const pages: (typeof userSet.cards[number] | null)[][] = [];
  for (let i = 0; i < totalPages; i++) {
    pages.push(userSet.cards.slice(i * CARDS_PER_PAGE, (i + 1) * CARDS_PER_PAGE));
  }

  // Pad the last page to have 9 slots
  if (pages.length > 0) {
    const lastPage = pages[pages.length - 1]!;
    while (lastPage.length < CARDS_PER_PAGE) {
      lastPage.push(null);
    }
  }

  // For now, show first 2 pages (or less if we don't have 2 pages)
  const visiblePages = pages.slice(0, PAGES_VISIBLE);

  return (
    <div className="flex gap-2 justify-center items-start">
      {visiblePages.map((page, pageIndex) => (
        <div
          key={pageIndex}
          className="bg-card border rounded-lg p-[2%] shadow-lg"
          style={{ width: "min(45vw, 500px)" }}
        >
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: CARDS_PER_PAGE }).map((_, slotIndex) => (
              <BinderCard
                key={`${pageIndex}-${slotIndex}`}
                cardData={page[slotIndex] ?? null}
                userCardsByCardId={userCardsByCardId}
                onCardClick={onCardClick}
              />
            ))}
          </div>
          <div className="text-center text-sm text-muted-foreground mt-4">
            Page {pageIndex + 1}
          </div>
        </div>
      ))}
    </div>
  );
}
