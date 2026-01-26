"use client";

import { api } from "@/lib/api/react";
import { Card } from "@/lib/db";
import { useRHFForm } from "@/lib/form/utils";
import React, { createContext, useContext, useEffect } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { BinderCardData, UserSet } from "./types";

export const PAGE_DIMENSIONS = { columns: 3, rows: 3 };
export const PAGE_SIZE = PAGE_DIMENSIONS.columns * PAGE_DIMENSIONS.rows;

type BinderContextValue = {
  form: ReturnType<typeof useForm<z.infer<typeof BinderFormSchema>>>;
  cardData: BinderCardData[];
  currentPosition: number | null;
  pickCardsForPosition: (position: number) => void;
  closeCardPicker: () => void;
  pagesCount: number;
  addPage: () => void;
  currentSpread: number;
  setCurrentSpread: React.Dispatch<React.SetStateAction<number>>;
};

const BinderContext = createContext<BinderContextValue | undefined>(undefined);

export function BinderProvider({
  children,
  initialUserSet,
}: {
  children: React.ReactNode;
  initialUserSet: UserSet;
}) {
  const [currentSpread, setCurrentSpread] = React.useState(0);

  const form = useRHFForm(BinderFormSchema, {
    defaultValues: {
      name: initialUserSet.set.name,
      image: initialUserSet.set.image,
      cardData: initialUserSet.cards.map((card, index) => ({
        cardId: card.id,
        order: index,
      })),
    },
  });

  const formCardData = form.watch("cardData");
  const { data: cards } = api.card.getByIds.useQuery(
    {
      cardIds: formCardData.map((cd) => cd.cardId),
    },
    {
      placeholderData: (previousData) => previousData,
    },
  );

  const cardData = formCardData.map((cd) => {
    const card = cards?.find((c) => c.id === cd.cardId);
    return { card, order: cd.order };
  });

  const [currentPosition, setCurrentPosition] = React.useState<number | null>(
    null,
  );

  function closeCardPicker() {
    setCurrentPosition(null);
  }

  // Always keep pagesCount even and at least 2
  const [pagesCount, setPagesCount] = React.useState(
    Math.max(Math.ceil(cardData.length / PAGE_SIZE), 2),
  );

  function addPage() {
    setPagesCount((prev) => Math.max(2, prev + 2 - (prev % 2)));
  }

  // Update pagesCount when cardData length changes
  useEffect(() => {
    const neededPages = Math.ceil(cardData.length / PAGE_SIZE);
    if (neededPages > pagesCount) {
      setPagesCount((prev) => Math.max(neededPages, 2));
    }
  }, [cardData.length, pagesCount]);

  return (
    <BinderContext.Provider
      value={{
        form,
        cardData,
        currentPosition,
        pickCardsForPosition: setCurrentPosition,
        closeCardPicker,
        pagesCount,
        addPage,
        currentSpread,
        setCurrentSpread,
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

export const BinderFormSchema = z.object({
  name: z.string().min(1, "Set name is required"),
  image: z.string().nullable(),
  cardData: z.array(
    z.object({
      cardId: z.string(),
      order: z.number(),
    }),
  ),
});
