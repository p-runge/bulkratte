"use client";

import { CardImageDialog } from "@/components/card-image";
import { AppRouter } from "@/lib/api/routers/_app";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

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
      <div className="aspect-245/337 bg-muted/30 rounded border-2 border-dashed border-muted-foreground/20" />
    );
  }

  const { id: userSetCardId, cardId, userCardId, card } = cardData;
  const isPlaced = !!userCardId;
  const hasUserCard = (userCardsByCardId[cardId]?.length ?? 0) > 0;

  return (
    <button
      onClick={() => onCardClick(userSetCardId, cardId, hasUserCard, isPlaced, userCardId)}
      className={cn(
        "cursor-pointer aspect-245/337 rounded relative overflow-hidden",
        "transition-all hover:scale-105",
        hasUserCard && !isPlaced && "border-4 border-yellow-500"
      )}
    >
      <div
        className={cn(
          "focus:outline-none focus:ring-4 focus:ring-ring focus:ring-offset-2",
          !isPlaced && "opacity-40 grayscale",
          hasUserCard && !isPlaced && "-m-1"
        )}
      >
        <Image
          src={card.imageSmall}
          alt={card.name}
          width={245}
          height={337}
          unoptimized
          className="w-full h-full object-contain rounded"
        />
      </div>
    </button>
  );
}

const CARDS_PER_PAGE = 9; // 3x3 grid

export function BinderView({ userSet, userCards, onCardClick }: BinderViewProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const PAGES_VISIBLE = isMobile ? 1 : 2;

  // Create a map of card_id to user cards for quick lookup
  const userCardsByCardId = userCards.reduce((acc, userCard) => {
    if (!acc[userCard.cardId]) {
      acc[userCard.cardId] = [];
    }
    acc[userCard.cardId]!.push(userCard);
    return acc;
  }, {} as Record<string, UserCard[]>);

  // Build an array with cards at their order positions, nulls for empty slots
  const maxOrder = Math.max(...userSet.cards.map((c) => c.order ?? 0), 0);
  const orderedCards: (typeof userSet.cards[number] | null)[] = Array(maxOrder + 1).fill(null);

  userSet.cards.forEach((card) => {
    if (card.order !== null && card.order !== undefined) {
      orderedCards[card.order] = card;
    }
  });

  // Ensure we have at least enough slots for the visible pages
  const minSlots = CARDS_PER_PAGE * PAGES_VISIBLE;
  while (orderedCards.length < minSlots) {
    orderedCards.push(null);
  }

  // Split cards into pages
  const totalPages = Math.ceil(orderedCards.length / CARDS_PER_PAGE);
  const pages: (typeof userSet.cards[number] | null)[][] = [];
  for (let i = 0; i < totalPages; i++) {
    pages.push(orderedCards.slice(i * CARDS_PER_PAGE, (i + 1) * CARDS_PER_PAGE));
  }

  // Pad the last page to have 9 slots
  if (pages.length > 0) {
    const lastPage = pages[pages.length - 1]!;
    while (lastPage.length < CARDS_PER_PAGE) {
      lastPage.push(null);
    }
  }

  // Navigation handlers
  const maxPageGroup = Math.max(0, Math.ceil(totalPages / PAGES_VISIBLE) - 1);
  const canGoNext = currentPage < maxPageGroup;
  const canGoPrev = currentPage > 0;

  const goNext = () => {
    if (canGoNext) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const goPrev = () => {
    if (canGoPrev) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // Arrow key support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, maxPageGroup]);

  // Swipe support
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0]!.clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0]!.clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && canGoNext) {
      goNext();
    } else if (isRightSwipe && canGoPrev) {
      goPrev();
    }
  };

  // Calculate visible pages based on current page
  const startPageIndex = currentPage * PAGES_VISIBLE;
  const visiblePages = pages.slice(startPageIndex, startPageIndex + PAGES_VISIBLE);

  return (
    <div className="relative">
      {/* Navigation Buttons */}
      {canGoPrev && (
        <Button
          variant="outline"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex"
          onClick={goPrev}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
      {canGoNext && (
        <Button
          variant="outline"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex"
          onClick={goNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      <div
        className="flex gap-2 justify-center items-start"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {visiblePages.map((page, pageIndex) => {
          const actualPageNumber = startPageIndex + pageIndex + 1;
          return (
            <div
              key={actualPageNumber}
              className="bg-card border rounded-lg p-[2%] shadow-lg"
              style={{ width: isMobile ? "min(90vw, 500px)" : "min(45vw, 500px)" }}
            >
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: CARDS_PER_PAGE }).map((_, slotIndex) => (
                  <BinderCard
                    key={`${actualPageNumber}-${slotIndex}`}
                    cardData={page[slotIndex] ?? null}
                    userCardsByCardId={userCardsByCardId}
                    onCardClick={onCardClick}
                  />
                ))}
              </div>
              <div className="text-center text-sm text-muted-foreground mt-4">
                Page {actualPageNumber}
              </div>
            </div>
          );
        })}
        {/* Invisible placeholder for single page on desktop */}
        {visiblePages.length === 1 && !isMobile && (
          <div
            className="invisible"
            style={{ width: "min(45vw, 500px)" }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Page indicator on mobile */}
      <div className="flex md:hidden justify-center gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={goPrev}
          disabled={!canGoPrev}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground self-center">
          {currentPage + 1} / {maxPageGroup + 1}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={goNext}
          disabled={!canGoNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
