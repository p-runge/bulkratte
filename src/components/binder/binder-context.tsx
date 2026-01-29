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
  removeCardAtPosition: (position: number) => void;
  sheetCount: number;
  insertSheet: (position: number) => void;
  deleteSheet: (sheetIndex: number) => void;
  reorderSheet: (fromIndex: number, toIndex: number) => void;
  currentSpread: number;
  setCurrentSpread: React.Dispatch<React.SetStateAction<number>>;
  // mode: create (new set), edit (modify structure), place (add user cards to slots)
  mode: "create" | "edit" | "place";
  interactionMode: "browse" | "remove"; // browse/remove for mobile compatibility
  setInteractionMode: React.Dispatch<React.SetStateAction<"browse" | "remove">>;
  userSetId: string | null; // Required for place mode
  // Place mode specific data
  userCards: any[] | null; // User's card collection for place mode
  onCardClick:
    | ((
        userSetCardId: string,
        cardId: string,
        hasUserCard: boolean,
        isPlaced: boolean,
        currentUserCardId: string | null,
      ) => void)
    | null;
  initialUserSet: UserSet; // Store original user set data for place mode
};

const BinderContext = createContext<BinderContextValue | undefined>(undefined);

export function BinderProvider({
  children,
  initialUserSet,
  mode,
  userSetId = null,
  userCards = null,
  onCardClick = null,
}: {
  children: React.ReactNode;
  initialUserSet: UserSet;
  mode: "create" | "edit" | "place";
  userSetId?: string | null;
  userCards?: any[] | null;
  onCardClick?:
    | ((
        userSetCardId: string,
        cardId: string,
        hasUserCard: boolean,
        isPlaced: boolean,
        currentUserCardId: string | null,
      ) => void)
    | null;
}) {
  const [currentSpread, setCurrentSpread] = React.useState(0);
  const [interactionMode, setInteractionMode] = React.useState<
    "browse" | "remove"
  >("browse");

  const form = useRHFForm(BinderFormSchema, {
    defaultValues: {
      name: initialUserSet.set.name,
      image: initialUserSet.set.image,
      cardData: initialUserSet.cards
        .filter((card) => card.cardId !== null && card.order !== null)
        .map((card) => ({
          cardId: card.cardId!,
          order: card.order!,
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

  function removeCardAtPosition(position: number) {
    const currentCardData = form.getValues("cardData");
    const newCardData = currentCardData.filter((cd) => cd.order !== position);
    form.setValue("cardData", newCardData);
  }

  // Always keep sheetCount at least 1
  const [sheetCount, setSheetCount] = React.useState(
    Math.max(Math.ceil(cardData.length / PAGE_SIZE / 2), 1),
  );

  function insertSheet(position: number) {
    // Insert a new sheet (2 pages) at the given position
    const insertAtPage = position * 2;
    const currentCardData = form.getValues("cardData");

    // Shift all cards at or after insertAtPage by 2 pages (2 * PAGE_SIZE positions)
    const shiftAmount = 2 * PAGE_SIZE;
    const newCardData = currentCardData.map((cd) => {
      if (cd.order >= insertAtPage * PAGE_SIZE) {
        return { ...cd, order: cd.order + shiftAmount };
      }
      return cd;
    });

    form.setValue("cardData", newCardData);
    setSheetCount((prev) => prev + 1);
  }

  function deleteSheet(sheetIndex: number) {
    // Delete a sheet (2 pages) at the given index
    const startPage = sheetIndex * 2;
    const startPosition = startPage * PAGE_SIZE;
    const endPosition = startPosition + 2 * PAGE_SIZE; // 2 pages worth of positions

    const currentCardData = form.getValues("cardData");

    // Remove cards in this range and shift remaining cards
    const newCardData = currentCardData
      .filter((cd) => cd.order < startPosition || cd.order >= endPosition)
      .map((cd) => {
        if (cd.order >= endPosition) {
          return { ...cd, order: cd.order - 2 * PAGE_SIZE };
        }
        return cd;
      });

    form.setValue("cardData", newCardData);
    setSheetCount((prev) => Math.max(1, prev - 1));

    // Adjust current spread if necessary
    const newSheetCount = Math.max(1, sheetCount - 1);
    const newMaxSpread = Math.max(0, newSheetCount - 1);
    if (currentSpread > newMaxSpread) {
      setCurrentSpread(newMaxSpread);
    }
  }

  function reorderSheet(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;

    const currentCardData = form.getValues("cardData");

    // Each sheet contains 2 pages
    const fromStartPage = fromIndex * 2;
    const fromEndPage = fromStartPage + 2;
    const toStartPage = toIndex * 2;

    // Extract cards from the source sheet
    const sheetCards = currentCardData.filter(
      (cd) =>
        cd.order >= fromStartPage * PAGE_SIZE &&
        cd.order < fromEndPage * PAGE_SIZE,
    );

    // Remove cards from the source sheet
    let newCardData = currentCardData.filter(
      (cd) =>
        cd.order < fromStartPage * PAGE_SIZE ||
        cd.order >= fromEndPage * PAGE_SIZE,
    );

    // Determine the shift direction
    if (fromIndex < toIndex) {
      // Moving down: shift cards between from and to up by 2 pages
      newCardData = newCardData.map((cd) => {
        if (
          cd.order >= fromEndPage * PAGE_SIZE &&
          cd.order < (toStartPage + 2) * PAGE_SIZE
        ) {
          return { ...cd, order: cd.order - 2 * PAGE_SIZE };
        }
        return cd;
      });

      // Insert cards at new position
      const insertPosition = toStartPage * PAGE_SIZE;
      const reorderedSheetCards = sheetCards.map((cd) => ({
        ...cd,
        order: cd.order - fromStartPage * PAGE_SIZE + insertPosition,
      }));

      newCardData = [...newCardData, ...reorderedSheetCards];
    } else {
      // Moving up: shift cards between to and from down by 2 pages
      newCardData = newCardData.map((cd) => {
        if (
          cd.order >= toStartPage * PAGE_SIZE &&
          cd.order < fromStartPage * PAGE_SIZE
        ) {
          return { ...cd, order: cd.order + 2 * PAGE_SIZE };
        }
        return cd;
      });

      // Insert cards at new position
      const insertPosition = toStartPage * PAGE_SIZE;
      const reorderedSheetCards = sheetCards.map((cd) => ({
        ...cd,
        order: cd.order - fromStartPage * PAGE_SIZE + insertPosition,
      }));

      newCardData = [...newCardData, ...reorderedSheetCards];
    }

    form.setValue("cardData", newCardData);
  }

  // Update form when initialUserSet changes (e.g., after refetch)
  useEffect(() => {
    form.reset({
      name: initialUserSet.set.name,
      image: initialUserSet.set.image,
      cardData: initialUserSet.cards
        .filter((card) => card.cardId !== null && card.order !== null)
        .map((card) => ({
          cardId: card.cardId!,
          order: card.order!,
        })),
    });
  }, [initialUserSet, form]);

  // Update sheetCount when cardData length changes
  useEffect(() => {
    const neededSheets = Math.ceil(cardData.length / PAGE_SIZE / 2);
    if (neededSheets > sheetCount) {
      setSheetCount(Math.max(neededSheets, 1));
    }
  }, [cardData.length, sheetCount]);

  return (
    <BinderContext.Provider
      value={{
        form,
        cardData,
        currentPosition,
        pickCardsForPosition: setCurrentPosition,
        closeCardPicker,
        removeCardAtPosition,
        sheetCount,
        insertSheet,
        deleteSheet,
        reorderSheet,
        currentSpread,
        setCurrentSpread,
        mode,
        interactionMode,
        setInteractionMode,
        userSetId,
        userCards,
        onCardClick,
        initialUserSet,
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
