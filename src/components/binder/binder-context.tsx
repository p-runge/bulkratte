"use client";

import { api } from "@/lib/api/react";
import {
  binderLayoutEnum,
  conditionEnum,
  languageEnum,
  variantEnum,
  type BinderLayout,
} from "@/lib/db/enums";
import { useRHFForm } from "@/lib/form/utils";
import React, { createContext, useContext, useEffect } from "react";
import { useForm } from "react-hook-form";
import { IntlShape, useIntl } from "react-intl";
import z from "zod";
import { BinderCard, BinderCardData, UserSet } from "./types";

export const BINDER_LAYOUT_CONFIGS: Record<
  BinderLayout,
  { columns: number; rows: number }
> = {
  "3x3": { columns: 3, rows: 3 },
  "4x3": { columns: 4, rows: 3 },
  "2x2": { columns: 2, rows: 2 },
};

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
  interactionMode: "browse" | "modify"; // browse/modify for mobile compatibility
  setInteractionMode: React.Dispatch<React.SetStateAction<"browse" | "modify">>;
  userSetId: string | null; // Required for place mode
  // Place mode specific data
  userCards: any[] | null; // User's card collection for place mode
  placedUserCards: Array<{
    userCardId: string;
    userSetId: string;
    userSetCardId: string;
    setName: string;
  }> | null; // Cards placed in any user set
  onCardClick:
    | ((
        userSetCardId: string,
        cardId: string,
        hasUserCard: boolean,
        isPlaced: boolean,
        currentUserCardId: string | null,
        card: BinderCard | undefined,
      ) => void)
    | null;
  initialUserSet: UserSet; // Store original user set data for place mode
  // Place mode filter toggles (only for place mode)
  considerPreferredLanguage?: boolean;
  considerPreferredVariant?: boolean;
  considerPreferredCondition?: boolean;
  setConsiderPreferredLanguage?: (value: boolean) => void;
  setConsiderPreferredVariant?: (value: boolean) => void;
  setConsiderPreferredCondition?: (value: boolean) => void;
  // Toggle to show detailed card preferences in place mode
  showCardPreferences?: boolean;
  setShowCardPreferences?: (value: boolean) => void;
  // Dynamic page dimensions derived from binderLayout
  pageDimensions: { columns: number; rows: number };
  pageSize: number;
};

const BinderContext = createContext<BinderContextValue | undefined>(undefined);

export function BinderProvider({
  children,
  initialUserSet,
  mode,
  userSetId = null,
  userCards = null,
  placedUserCards = null,
  onCardClick = null,
}: {
  children: React.ReactNode;
  initialUserSet: UserSet;
  mode: "create" | "edit" | "place";
  userSetId?: string | null;
  userCards?: any[] | null;
  placedUserCards?: Array<{
    userCardId: string;
    userSetId: string;
    userSetCardId: string;
    setName: string;
  }> | null;
  onCardClick?:
    | ((
        userSetCardId: string,
        cardId: string,
        hasUserCard: boolean,
        isPlaced: boolean,
        currentUserCardId: string | null,
        card: BinderCard | undefined,
      ) => void)
    | null;
}) {
  const intl = useIntl();
  const [currentSpread, setCurrentSpread] = React.useState(0);
  const [interactionMode, setInteractionMode] = React.useState<
    "browse" | "modify"
  >("browse");

  const [considerPreferredLanguage, setConsiderPreferredLanguage] =
    React.useState(true);
  const [considerPreferredVariant, setConsiderPreferredVariant] =
    React.useState(true);
  const [considerPreferredCondition, setConsiderPreferredCondition] =
    React.useState(true);
  const [showCardPreferences, setShowCardPreferences] = React.useState(false);

  const form = useRHFForm(getBinderFormSchema(intl), {
    defaultValues: {
      name: initialUserSet.set.name,
      image: initialUserSet.set.image,
      cardData: initialUserSet.cards
        .filter((card) => card.cardId !== null && card.order !== null)
        .map((card) => ({
          cardId: card.cardId!,
          order: card.order!,
          preferredLanguage: card.preferredLanguage ?? null,
          preferredVariant: card.preferredVariant ?? null,
          preferredCondition: card.preferredCondition ?? null,
        })),
      preferredLanguage: initialUserSet.set.preferredLanguage ?? null,
      preferredVariant: initialUserSet.set.preferredVariant ?? null,
      preferredCondition: initialUserSet.set.preferredCondition ?? null,
      binderLayout: initialUserSet.set.binderLayout ?? "3x3",
    },
  });

  const binderLayout = (form.watch("binderLayout") ?? "3x3") as BinderLayout;
  const pageDimensions = BINDER_LAYOUT_CONFIGS[binderLayout];
  const pageSize = pageDimensions.columns * pageDimensions.rows;

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

  const getNeededSheets = (cards: typeof formCardData, size: number) => {
    const maxOrder =
      cards.length > 0 ? Math.max(...cards.map((cd) => cd.order)) : -1;
    return Math.max(Math.ceil((maxOrder + 1) / size / 2), 1);
  };

  // Always keep sheetCount at least 1
  const [sheetCount, setSheetCount] = React.useState(() =>
    getNeededSheets(formCardData, pageSize),
  );
  const prevPageSizeRef = React.useRef(pageSize);

  function insertSheet(position: number) {
    // Insert a new sheet (2 pages) at the given position
    const insertAtPage = position * 2;
    const currentCardData = form.getValues("cardData");

    // Shift all cards at or after insertAtPage by 2 pages (2 * pageSize positions)
    const shiftAmount = 2 * pageSize;
    const newCardData = currentCardData.map((cd) => {
      if (cd.order >= insertAtPage * pageSize) {
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
    const startPosition = startPage * pageSize;
    const endPosition = startPosition + 2 * pageSize; // 2 pages worth of positions

    const currentCardData = form.getValues("cardData");

    // Remove cards in this range and shift remaining cards
    const newCardData = currentCardData
      .filter((cd) => cd.order < startPosition || cd.order >= endPosition)
      .map((cd) => {
        if (cd.order >= endPosition) {
          return { ...cd, order: cd.order - 2 * pageSize };
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
        cd.order >= fromStartPage * pageSize &&
        cd.order < fromEndPage * pageSize,
    );

    // Remove cards from the source sheet
    let newCardData = currentCardData.filter(
      (cd) =>
        cd.order < fromStartPage * pageSize ||
        cd.order >= fromEndPage * pageSize,
    );

    // Determine the shift direction
    if (fromIndex < toIndex) {
      // Moving down: shift cards between from and to up by 2 pages
      newCardData = newCardData.map((cd) => {
        if (
          cd.order >= fromEndPage * pageSize &&
          cd.order < (toStartPage + 2) * pageSize
        ) {
          return { ...cd, order: cd.order - 2 * pageSize };
        }
        return cd;
      });

      // Insert cards at new position
      const insertPosition = toStartPage * pageSize;
      const reorderedSheetCards = sheetCards.map((cd) => ({
        ...cd,
        order: cd.order - fromStartPage * pageSize + insertPosition,
      }));

      newCardData = [...newCardData, ...reorderedSheetCards];
    } else {
      // Moving up: shift cards between to and from down by 2 pages
      newCardData = newCardData.map((cd) => {
        if (
          cd.order >= toStartPage * pageSize &&
          cd.order < fromStartPage * pageSize
        ) {
          return { ...cd, order: cd.order + 2 * pageSize };
        }
        return cd;
      });

      // Insert cards at new position
      const insertPosition = toStartPage * pageSize;
      const reorderedSheetCards = sheetCards.map((cd) => ({
        ...cd,
        order: cd.order - fromStartPage * pageSize + insertPosition,
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
          preferredLanguage: card.preferredLanguage ?? null,
          preferredVariant: card.preferredVariant ?? null,
          preferredCondition: card.preferredCondition ?? null,
        })),
      preferredLanguage: initialUserSet.set.preferredLanguage ?? null,
      preferredVariant: initialUserSet.set.preferredVariant ?? null,
      preferredCondition: initialUserSet.set.preferredCondition ?? null,
      binderLayout: initialUserSet.set.binderLayout ?? "3x3",
    });
  }, [initialUserSet, form]);

  // Recalculate sheetCount when layout changes (can shrink) or when cards
  // exceed current capacity (only grows).
  useEffect(() => {
    const neededSheets = getNeededSheets(formCardData, pageSize);
    const layoutChanged = prevPageSizeRef.current !== pageSize;
    prevPageSizeRef.current = pageSize;
    if (layoutChanged) {
      setSheetCount(neededSheets);
      // Clamp the active spread to the new max so it doesn't point at a
      // page that no longer exists.
      setCurrentSpread((s) => Math.min(s, neededSheets));
    } else if (neededSheets > sheetCount) {
      setSheetCount(neededSheets);
    }
  }, [formCardData, pageSize, sheetCount]);

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
        placedUserCards,
        onCardClick,
        initialUserSet,
        considerPreferredLanguage,
        considerPreferredVariant,
        considerPreferredCondition,
        setConsiderPreferredLanguage,
        setConsiderPreferredVariant,
        setConsiderPreferredCondition,
        showCardPreferences,
        setShowCardPreferences,
        pageDimensions,
        pageSize,
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

export function getBinderFormSchema(intl: IntlShape) {
  return z.object({
    name: z.string().min(
      1,
      intl.formatMessage({
        id: "form.validation.set_name_required",
        defaultMessage: "Set name is required",
      }),
    ),
    image: z.string().nullable(),
    cardData: z.array(
      z.object({
        cardId: z.string(),
        order: z.number(),
        preferredLanguage: z
          .enum(languageEnum.enumValues)
          .nullable()
          .optional(),
        preferredVariant: z.enum(variantEnum.enumValues).nullable().optional(),
        preferredCondition: z
          .enum(conditionEnum.enumValues)
          .nullable()
          .optional(),
      }),
    ),
    preferredLanguage: z.enum(languageEnum.enumValues).nullable(),
    preferredVariant: z.enum(variantEnum.enumValues).nullable(),
    preferredCondition: z.enum(conditionEnum.enumValues).nullable(),
    binderLayout: z.enum(binderLayoutEnum.enumValues).default("3x3"),
  });
}

// For backwards compatibility
export const BinderFormSchema = z.object({
  name: z.string().min(1, "Set name is required"),
  image: z.string().nullable(),
  cardData: z.array(
    z.object({
      cardId: z.string(),
      order: z.number(),
      preferredLanguage: z.enum(languageEnum.enumValues).nullable().optional(),
      preferredVariant: z.enum(variantEnum.enumValues).nullable().optional(),
      preferredCondition: z
        .enum(conditionEnum.enumValues)
        .nullable()
        .optional(),
    }),
  ),
  preferredLanguage: z.enum(languageEnum.enumValues).nullable(),
  preferredVariant: z.enum(variantEnum.enumValues).nullable(),
  preferredCondition: z.enum(conditionEnum.enumValues).nullable(),
  binderLayout: z.enum(binderLayoutEnum.enumValues).default("3x3"),
});
