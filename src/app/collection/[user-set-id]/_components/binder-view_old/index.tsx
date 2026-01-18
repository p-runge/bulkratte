"use client";

import { useState } from "react";
import {
  CARDS_PER_PAGE,
  useBinderPagination,
} from "../../_lib/use-binder-pagination";
import { SetInfo } from "../set-info";
import { BinderPage } from "./binder-page";
import { EditModeControls } from "./edit-mode-controls";
import { MobilePageIndicator } from "./mobile-page-indicator";
import { NavigationButtons } from "./navigation-buttons";
import { UserCard, UserSet } from "./types";
import { MinimalCardData } from "../edit-set-content";

interface ViewModeProps {
  mode: "view";
  userSet: UserSet;
  userCards: UserCard[];
  onCardClick: (
    userSetCardId: string,
    cardId: string,
    hasUserCard: boolean,
    isPlaced: boolean,
    currentUserCardId: string | null,
  ) => void;
}

interface EditModeProps {
  mode: "edit";
  cards: Array<{ userSetCardId: string | null; cardId: string | null }>;
  cardDataMap: Map<string, MinimalCardData>;
  onCardsChange: (
    cards: Array<{ userSetCardId: string | null; cardId: string | null }>,
  ) => void;
}

export type BinderViewProps = ViewModeProps | EditModeProps;

export function BinderView(props: BinderViewProps) {
  const isEditMode = props.mode === "edit";

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addingAtIndex, setAddingAtIndex] = useState<number | null>(null);

  const { orderedCards: preparedCards, userCardsByCardId } =
    prepareCardData(props);

  const pagination = useBinderPagination({ totalItems: preparedCards.length });
  const {
    isMobile,
    PAGES_VISIBLE,
    buildPagesArray,
    isCoverPage,
    getDisplayPageNumber,
    getTotalPages,
    canGoNext,
    canGoPrev,
    goNext,
    goPrev,
    useKeyboardNavigation,
    getVisiblePages,
    getStartPageIndex,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    setCurrentPage,
  } = pagination;

  const minSlots = CARDS_PER_PAGE * PAGES_VISIBLE;
  const orderedCards = ensureMinimumSlots(preparedCards, minSlots, isEditMode);

  const pages = buildPagesArray(
    orderedCards,
    isEditMode ? { userSetCardId: null, cardId: null } : null,
  );
  const totalPages = getTotalPages(pages);
  const totalContentPages = Math.ceil(orderedCards.length / CARDS_PER_PAGE);

  useKeyboardNavigation(totalPages);

  const visiblePages = getVisiblePages(pages);
  const startPageIndex = getStartPageIndex();

  const dragHandlers = useDragHandlers(
    draggedIndex,
    setDraggedIndex,
    orderedCards,
    isEditMode,
    props,
  );

  const cardManagement = useCardManagement(
    orderedCards,
    isEditMode,
    props,
    addingAtIndex,
    setAddingAtIndex,
    setAddDialogOpen,
  );

  const pageManagement = usePageManagement(
    orderedCards,
    minSlots,
    isEditMode,
    props,
    pagination,
    setCurrentPage,
  );

  const hasEmptySlots =
    isEditMode && orderedCards.some((card) => card.cardId === null);

  return (
    <>
      {!isEditMode && (
        <SetInfo userSet={props.userSet} userCards={props.userCards} />
      )}

      <div className="relative">
        <NavigationButtons
          canGoPrev={canGoPrev()}
          canGoNext={canGoNext(totalPages)}
          onPrev={() => goPrev()}
          onNext={() => goNext(totalPages)}
        />

        <div
          className="flex gap-2 justify-center"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={() => onTouchEnd(totalPages)}
        >
          {visiblePages.map((page, pageIndex) => {
            const actualPageNumber = startPageIndex + pageIndex + 1;
            const isCurrentCoverPage = isCoverPage(
              actualPageNumber,
              totalPages,
            );

            return (
              <BinderPage
                key={actualPageNumber}
                page={page}
                actualPageNumber={actualPageNumber}
                isCurrentCoverPage={isCurrentCoverPage}
                isMobile={isMobile}
                pageIndex={pageIndex}
                startPageIndex={startPageIndex}
                mode={props.mode}
                totalContentPages={totalContentPages}
                pagesVisible={PAGES_VISIBLE}
                cardDataMap={isEditMode ? props.cardDataMap : undefined}
                userCardsByCardId={!isEditMode ? userCardsByCardId : undefined}
                draggedIndex={draggedIndex}
                onCardClick={!isEditMode ? props.onCardClick : undefined}
                onRemove={isEditMode ? cardManagement.handleRemove : undefined}
                onAdd={isEditMode ? cardManagement.handleAdd : undefined}
                onDragStart={
                  isEditMode ? dragHandlers.handleDragStart : undefined
                }
                onDragOver={
                  isEditMode ? dragHandlers.handleDragOver : undefined
                }
                onDrop={isEditMode ? dragHandlers.handleDrop : undefined}
                onDeletePage={
                  isEditMode ? pageManagement.handleDeletePage : undefined
                }
                getDisplayPageNumber={getDisplayPageNumber}
              />
            );
          })}

          {visiblePages.length === 1 && !isMobile && (
            <div
              className="invisible"
              style={{ width: "min(45vw, 500px)" }}
              aria-hidden="true"
            />
          )}
        </div>

        <MobilePageIndicator
          currentPage={pagination.currentPage}
          totalPages={pagination.getMaxPageGroup(totalPages)}
          canGoPrev={canGoPrev()}
          canGoNext={canGoNext(totalPages)}
          onPrev={() => goPrev()}
          onNext={() => goNext(totalPages)}
        />

        {isEditMode && (
          <EditModeControls
            hasEmptySlots={hasEmptySlots}
            onAddPage={pageManagement.handleAddPage}
            addDialogOpen={addDialogOpen}
            setAddDialogOpen={setAddDialogOpen}
            onCardSelect={cardManagement.handleCardSelect}
          />
        )}
      </div>
    </>
  );
}

function prepareCardData(props: BinderViewProps) {
  let orderedCards: any[];
  let userCardsByCardId: Record<string, UserCard[]> = {};

  if (props.mode === "edit") {
    orderedCards = [...props.cards];
  } else {
    userCardsByCardId = props.userCards.reduce(
      (acc, userCard) => {
        if (!acc[userCard.cardId]) {
          acc[userCard.cardId] = [];
        }
        acc[userCard.cardId]!.push(userCard);
        return acc;
      },
      {} as Record<string, UserCard[]>,
    );

    const maxOrder = Math.max(
      ...props.userSet.cards.map((c) => c.order ?? 0),
      0,
    );
    const tempOrderedCards: ((typeof props.userSet.cards)[number] | null)[] =
      Array(maxOrder + 1).fill(null);

    props.userSet.cards.forEach((card) => {
      if (card.order !== null && card.order !== undefined) {
        tempOrderedCards[card.order] = card;
      }
    });
    orderedCards = tempOrderedCards;
  }

  return { orderedCards, userCardsByCardId };
}

function ensureMinimumSlots(
  orderedCards: any[],
  minSlots: number,
  isEditMode: boolean,
) {
  const result = [...orderedCards];
  while (result.length < minSlots) {
    result.push(isEditMode ? { userSetCardId: null, cardId: null } : null);
  }
  return result;
}

function useDragHandlers(
  draggedIndex: number | null,
  setDraggedIndex: (index: number | null) => void,
  orderedCards: any[],
  isEditMode: boolean,
  props: BinderViewProps,
) {
  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (targetIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();

    if (!isEditMode || draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }

    const newCards = [...orderedCards];
    const draggedCard = newCards[draggedIndex];

    newCards[draggedIndex] = newCards[targetIndex] ?? {
      userSetCardId: null,
      cardId: null,
    };
    newCards[targetIndex] = draggedCard ?? {
      userSetCardId: null,
      cardId: null,
    };

    const trimmed = trimEmptyTrailing(newCards);
    if (props.mode === "edit") {
      props.onCardsChange(trimmed);
    }
    setDraggedIndex(null);
  };

  return { handleDragStart, handleDragOver, handleDrop };
}

function useCardManagement(
  orderedCards: any[],
  isEditMode: boolean,
  props: BinderViewProps,
  addingAtIndex: number | null,
  setAddingAtIndex: (index: number | null) => void,
  setAddDialogOpen: (open: boolean) => void,
) {
  const handleRemove = (index: number) => {
    if (!isEditMode || props.mode !== "edit") return;

    const newCards = [...orderedCards];
    newCards[index] = { userSetCardId: null, cardId: null };

    const trimmed = trimEmptyTrailing(newCards);
    props.onCardsChange(trimmed);
  };

  const handleAdd = (index: number) => {
    if (!isEditMode) return;
    setAddingAtIndex(index);
    setAddDialogOpen(true);
  };

  const handleCardSelect = (selectedCardIds: Set<string>) => {
    if (!isEditMode || addingAtIndex === null || props.mode !== "edit") return;

    const newCards = [...orderedCards];
    const cardsToAdd = Array.from(selectedCardIds);

    let insertIndex = addingAtIndex;
    for (const cardId of cardsToAdd) {
      while (
        insertIndex < newCards.length &&
        newCards[insertIndex]?.cardId !== null
      ) {
        insertIndex++;
      }

      if (insertIndex < newCards.length) {
        newCards[insertIndex] = { userSetCardId: null, cardId };
      } else {
        newCards.push({ userSetCardId: null, cardId });
      }
      insertIndex++;
    }

    const trimmed = trimEmptyTrailing(newCards);
    props.onCardsChange(trimmed);
    setAddDialogOpen(false);
    setAddingAtIndex(null);
  };

  return { handleRemove, handleAdd, handleCardSelect };
}

function usePageManagement(
  orderedCards: any[],
  minSlots: number,
  isEditMode: boolean,
  props: BinderViewProps,
  pagination: ReturnType<typeof useBinderPagination>,
  setCurrentPage: (page: number) => void,
) {
  const handleAddPage = () => {
    if (!isEditMode || props.mode !== "edit") return;

    const newCards = [...orderedCards];
    for (let i = 0; i < CARDS_PER_PAGE; i++) {
      newCards.push({ userSetCardId: null, cardId: null });
    }
    props.onCardsChange(newCards);

    const newPages = pagination.buildPagesArray(newCards, {
      userSetCardId: null,
      cardId: null,
    });
    const newTotalPages = pagination.getTotalPages(newPages);
    const newMaxPageGroup = pagination.getMaxPageGroup(newTotalPages);
    setCurrentPage(newMaxPageGroup);
  };

  const handleDeletePage = (pageNumber: number) => {
    if (!isEditMode || props.mode !== "edit") return;

    const pageStartIndex = (pageNumber - 1) * CARDS_PER_PAGE;
    const pageEndIndex = pageStartIndex + CARDS_PER_PAGE;

    const newCards = [
      ...orderedCards.slice(0, pageStartIndex),
      ...orderedCards.slice(pageEndIndex),
    ];

    const trimmed = trimEmptyTrailing(newCards);
    props.onCardsChange(trimmed);

    const newPaddedCards = [...trimmed];
    while (newPaddedCards.length < minSlots) {
      newPaddedCards.push({ userSetCardId: null, cardId: null });
    }
    const newPages = pagination.buildPagesArray(newPaddedCards, {
      userSetCardId: null,
      cardId: null,
    });
    const newTotalPages = pagination.getTotalPages(newPages);
    const newMaxPageGroup = pagination.getMaxPageGroup(newTotalPages);
    if (pagination.currentPage > newMaxPageGroup) {
      setCurrentPage(newMaxPageGroup);
    }
  };

  return { handleAddPage, handleDeletePage };
}

function trimEmptyTrailing(cards: any[]) {
  const lastNonEmptyIndex = cards.findLastIndex((c) => c.cardId !== null);
  return lastNonEmptyIndex >= 0 ? cards.slice(0, lastNonEmptyIndex + 1) : [];
}
