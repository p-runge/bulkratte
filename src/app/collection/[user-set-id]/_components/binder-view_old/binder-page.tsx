import ConfirmButton from "@/components/confirm-button";
import { Trash2 } from "lucide-react";
import { FormattedMessage } from "react-intl";
import { EditSlot } from "./edit-slot";
import { ViewSlot } from "./view-slot";
import { UserSet, UserCard } from "./types";
import { MinimalCardData } from "../edit-set-content";

interface BinderPageProps {
  page: any[];
  actualPageNumber: number;
  isCurrentCoverPage: boolean;
  isMobile: boolean;
  pageIndex: number;
  startPageIndex: number;
  mode: "view" | "edit";
  totalContentPages: number;
  pagesVisible: number;
  cardDataMap?: Map<string, MinimalCardData>;
  userCardsByCardId?: Record<string, UserCard[]>;
  draggedIndex: number | null;
  onCardClick?: (
    userSetCardId: string,
    cardId: string,
    hasUserCard: boolean,
    isPlaced: boolean,
    currentUserCardId: string | null,
  ) => void;
  onRemove?: (index: number) => void;
  onAdd?: (index: number) => void;
  onDragStart?: (index: number) => (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (index: number) => (e: React.DragEvent) => void;
  onDeletePage?: (pageNumber: number) => void;
  getDisplayPageNumber: (pageNumber: number) => number;
}

export function BinderPage({
  page,
  actualPageNumber,
  isCurrentCoverPage,
  isMobile,
  pageIndex,
  startPageIndex,
  mode,
  totalContentPages,
  pagesVisible,
  cardDataMap,
  userCardsByCardId,
  draggedIndex,
  onCardClick,
  onRemove,
  onAdd,
  onDragStart,
  onDragOver,
  onDrop,
  onDeletePage,
  getDisplayPageNumber,
}: BinderPageProps) {
  const CARDS_PER_PAGE = 9;
  const isEditMode = mode === "edit";

  return (
    <div
      className="bg-card border rounded-lg p-[2%] shadow-lg relative"
      style={{
        width: isMobile ? "min(90vw, 500px)" : "min(45vw, 500px)",
      }}
    >
      {isEditMode &&
        !isCurrentCoverPage &&
        totalContentPages > (isMobile ? 1 : pagesVisible) &&
        onDeletePage && (
          <div className="absolute -top-3 -right-3 z-10">
            <ConfirmButton
              variant="destructive"
              size="icon"
              className="h-8 w-8 rounded-full shadow-md"
              title="Delete Page"
              description={`Are you sure you want to delete page ${getDisplayPageNumber(
                actualPageNumber,
              )}? All cards on this page will be removed.`}
              destructive
              onClick={() => onDeletePage(actualPageNumber)}
            >
              <Trash2 className="h-4 w-4" />
            </ConfirmButton>
          </div>
        )}

      {!isCurrentCoverPage && (
        <div className="grid grid-cols-3 gap-2">
          {page.map((card, slotIndex) => {
            const globalIndex =
              (startPageIndex + pageIndex - (isMobile ? 0 : 1)) *
                CARDS_PER_PAGE +
              slotIndex;

            if (isEditMode && cardDataMap && onRemove && onAdd && onDragStart && onDragOver && onDrop) {
              const cardData = card?.cardId
                ? (cardDataMap.get(card.cardId) ?? null)
                : null;

              return (
                <EditSlot
                  key={globalIndex}
                  card={cardData}
                  onRemove={() => onRemove(globalIndex)}
                  onAdd={() => onAdd(globalIndex)}
                  onDragStart={onDragStart(globalIndex)}
                  onDragOver={onDragOver}
                  onDrop={onDrop(globalIndex)}
                  isDragging={draggedIndex === globalIndex}
                />
              );
            } else if (userCardsByCardId && onCardClick) {
              return (
                <ViewSlot
                  key={`${actualPageNumber}-${slotIndex}`}
                  cardData={card ?? null}
                  userCardsByCardId={userCardsByCardId}
                  onCardClick={onCardClick}
                />
              );
            }
            return null;
          })}
        </div>
      )}

      <div className="text-center text-sm text-muted-foreground mt-4">
        {isCurrentCoverPage ? (
          <span className="opacity-0">Cover</span>
        ) : isEditMode ? (
          `Page ${getDisplayPageNumber(actualPageNumber)}`
        ) : (
          <FormattedMessage
            id="binder.page.number"
            defaultMessage="Page {pageNumber}"
            values={{
              pageNumber: getDisplayPageNumber(actualPageNumber),
            }}
          />
        )}
      </div>
    </div>
  );
}
