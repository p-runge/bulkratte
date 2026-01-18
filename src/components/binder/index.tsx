import BinderPage from "./binder-page";
import { BinderCard, BinderCardData } from "./types";

type BinderViewProps = {
  cardData: BinderCardData[];
};

export const PAGE_DIMENSIONS = { columns: 3, rows: 3 };
const PAGE_SIZE = PAGE_DIMENSIONS.columns * PAGE_DIMENSIONS.rows;

export function Binder({ cardData }: BinderViewProps) {
  const orderedCards = generateOrderedCards(cardData);

  const pages = splitIntoPages(orderedCards, PAGE_SIZE);

  return (
    <div className="flex flex-col gap-8">
      {pages.map((pageCards, pageIndex) => (
        <BinderPage
          key={pageIndex}
          cards={pageCards}
          pageNumber={pageIndex + 1}
        />
      ))}
    </div>
  );
}

function generateOrderedCards(
  cardData: BinderCardData[],
): (BinderCard | null)[] {
  if (cardData.length === 0) return [];

  const maxOrder = Math.max(...cardData.map((cd) => cd.order));
  const orderedCards: (BinderCard | null)[] = new Array(maxOrder + 1).fill(
    null,
  );

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
