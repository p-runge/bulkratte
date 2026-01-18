import { FormattedMessage } from "react-intl";
import { PAGE_DIMENSIONS } from ".";
import CardSlot from "./card-slot";
import { BinderCard } from "./types";

export default function BinderPage({
  cards,
  pageNumber,
}: {
  cards: (BinderCard | null)[];
  pageNumber: number;
}) {
  return (
    <div className="bg-white border border-gray-300 shadow-sm p-4 rounded-lg">
      <h3 className="text-sm font-medium text-gray-500 mb-4">
        <FormattedMessage
          id="binder.pageNumber"
          defaultMessage="Page {number}"
          values={{ number: pageNumber }}
        />
      </h3>
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${PAGE_DIMENSIONS.columns}, minmax(0, 1fr))`,
        }}
      >
        {cards.map((card, index) => (
          <CardSlot key={index} card={card} />
        ))}
      </div>
    </div>
  );
}
