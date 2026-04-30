"use client";

import { CardBrowser } from "@/components/card-browser";
import { FormattedMessage } from "react-intl";

export default function CardsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">
        <FormattedMessage id="page.cards.title" defaultMessage="All Cards" />
      </h1>

      <CardBrowser selectionMode="single" onCardClick={() => {}} />
    </div>
  );
}
