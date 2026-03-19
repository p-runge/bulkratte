"use client";

import type { SortState } from "@/components/card-browser/card-filters";
import * as React from "react";

type UiPreferences = {
  cardBrowserSort: SortState;
  setCardBrowserSort: (sort: SortState) => void;
};

const DEFAULT_SORT: SortState = { sortBy: "set-and-number", sortOrder: "asc" };

const UiPreferencesContext = React.createContext<UiPreferences>({
  cardBrowserSort: DEFAULT_SORT,
  setCardBrowserSort: () => {},
});

export function UiPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cardBrowserSort, setCardBrowserSort] =
    React.useState<SortState>(DEFAULT_SORT);

  return (
    <UiPreferencesContext.Provider
      value={{ cardBrowserSort, setCardBrowserSort }}
    >
      {children}
    </UiPreferencesContext.Provider>
  );
}

export function useUiPreferences() {
  return React.useContext(UiPreferencesContext);
}
