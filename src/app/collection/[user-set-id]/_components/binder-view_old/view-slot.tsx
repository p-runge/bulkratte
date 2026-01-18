import { cn } from "@/lib/utils";
import Image from "next/image";
import { UserSet, UserCard } from "./types";

interface ViewSlotProps {
  cardData: UserSet["cards"][number] | null;
  userCardsByCardId: Record<string, UserCard[]>;
  onCardClick: (
    userSetCardId: string,
    cardId: string,
    hasUserCard: boolean,
    isPlaced: boolean,
    currentUserCardId: string | null,
  ) => void;
}

export function ViewSlot({
  cardData,
  userCardsByCardId,
  onCardClick,
}: ViewSlotProps) {
  if (!cardData || !cardData.card) {
    return (
      <div className="aspect-245/337 bg-muted/30 rounded border-2 border-dashed border-muted-foreground/20" />
    );
  }

  const { id: userSetCardId, cardId, userCardId, card } = cardData;
  const isPlaced = !!userCardId;
  const hasUserCard = (userCardsByCardId[cardId]?.length ?? 0) > 0;

  return (
    <button
      onClick={() =>
        onCardClick(userSetCardId, cardId, hasUserCard, isPlaced, userCardId)
      }
      className={cn(
        "cursor-pointer aspect-245/337 rounded relative overflow-hidden",
        "transition-all hover:scale-105",
        hasUserCard && !isPlaced && "border-4 border-yellow-500",
      )}
    >
      <div
        className={cn(
          "focus:outline-none focus:ring-4 focus:ring-ring focus:ring-offset-2",
          !isPlaced && "opacity-40 grayscale",
          hasUserCard && !isPlaced && "-m-1",
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
