import { useBinderContext } from "./binder-context";
import BinderPage from "./binder-page";
import { BinderCard, BinderCardData } from "./types";

export const PAGE_DIMENSIONS = { columns: 3, rows: 3 };
const PAGE_SIZE = PAGE_DIMENSIONS.columns * PAGE_DIMENSIONS.rows;

export function Binder() {
  const { cardData } = useBinderContext();
  const orderedCards = generateOrderedCards(cardData);

  // ensure the amount of cards is a multiple of PAGE_SIZE * 2, and is at least PAGE_SIZE * 2
  const amountOfCards = Math.max(
    PAGE_SIZE * 2,
    Math.ceil(orderedCards.length / (PAGE_SIZE * 2)) * (PAGE_SIZE * 2),
  );
  while (orderedCards.length < amountOfCards) {
    orderedCards.push(null);
  }

  const pages = splitIntoPages(orderedCards, PAGE_SIZE);

  return (
    <div className="flex gap-8 justify-center">
      {pages.map((pageCards, pageIndex) => (
        <BinderPage
          key={pageIndex}
          cards={pageCards}
          pageNumber={pageIndex + 1}
          pageStartIndex={pageIndex * PAGE_SIZE}
        />
      ))}
    </div>
  );
}

function generateOrderedCards(
  cardData: BinderCardData[],
): (BinderCard | null | undefined)[] {
  if (cardData.length === 0) return [];

  const maxOrder = Math.max(...cardData.map((cd) => cd.order));
  const orderedCards: (BinderCard | null | undefined)[] = new Array(
    maxOrder + 1,
  ).fill(null);

  cardData.forEach(({ card, order }) => {
    orderedCards[order] = card;
  });

  return orderedCards;
}

function splitIntoPages<T>(items: T[], pageSize: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += pageSize) {
    pages.push(items.slice(i, i + pageSize));
  }
  return pages;
}
