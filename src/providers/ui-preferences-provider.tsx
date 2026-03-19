"use client";

import type { SortState } from "@/components/card-browser/card-filters";
import * as React from "react";

export type CardBrowserView = "grid" | "list";

type UiPreferences = {
  cardBrowserSort: SortState;
  setCardBrowserSort: (sort: SortState) => void;
  cardBrowserView: CardBrowserView;
  setCardBrowserView: (view: CardBrowserView) => void;
};

const DEFAULT_SORT: SortState = { sortBy: "set-and-number", sortOrder: "asc" };

const UiPreferencesContext = React.createContext<UiPreferences>({
  cardBrowserSort: DEFAULT_SORT,
  setCardBrowserSort: () => {},
  cardBrowserView: "grid",
  setCardBrowserView: () => {},
});

export function UiPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cardBrowserSort, setCardBrowserSort] =
    React.useState<SortState>(DEFAULT_SORT);
  const [cardBrowserView, setCardBrowserView] =
    React.useState<CardBrowserView>("grid");

  return (
    <UiPreferencesContext.Provider
      value={{
        cardBrowserSort,
        setCardBrowserSort,
        cardBrowserView,
        setCardBrowserView,
      }}
    >
      {children}
    </UiPreferencesContext.Provider>
  );
}

export function useUiPreferences() {
  return React.useContext(UiPreferencesContext);
}
