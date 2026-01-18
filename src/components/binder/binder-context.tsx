"use client";

import React, { createContext, useContext, useState } from "react";
import { BinderCard } from "./types";

type BinderContextValue = {
  pickCardsForPosition: (position: number) => void;
  addCardsToPosition: (position: number, cards: BinderCard[]) => void;
  currentPosition: number | null;
  closeCardPicker: () => void;
};

const BinderContext = createContext<BinderContextValue | undefined>(undefined);

export function BinderProvider({
  children,
  onAddCards,
}: {
  children: React.ReactNode;
  onAddCards?: (position: number, cards: BinderCard[]) => void;
}) {
  const [currentPosition, setCurrentPosition] = useState<number | null>(null);

  const pickCardsForPosition = (position: number) => {
    setCurrentPosition(position);
  };

  const addCardsToPosition = (position: number, cards: BinderCard[]) => {
    onAddCards?.(position, cards);
    setCurrentPosition(null);
  };

  const closeCardPicker = () => {
    setCurrentPosition(null);
  };

  return (
    <BinderContext.Provider
      value={{
        currentPosition,
        pickCardsForPosition,
        addCardsToPosition,
        closeCardPicker,
      }}
    >
      {children}
    </BinderContext.Provider>
  );
}

export function useBinderContext() {
  const context = useContext(BinderContext);
  if (!context) {
    throw new Error("useBinderContext must be used within BinderProvider");
  }
  return context;
}
