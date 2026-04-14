"use client";

import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BetweenHorizonalStart, GripVertical, Trash2 } from "lucide-react";
import Image from "next/image";
import React, { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import ConfirmButton from "../../confirm-button";
import { Button } from "../../ui/button";
import { useBinderContext } from "../binder-context";
import { BinderCard, BinderCardData } from "../types";
import { CARD_ASPECT_CLASS, CARD_BORDER_RADIUS } from "@/lib/card-config";
import type { BinderLayout } from "@/lib/db/enums";

const GRID_CLASSES: Record<BinderLayout, string> = {
  "3x3": "grid-cols-3 grid-rows-3",
  "4x3": "grid-cols-4 grid-rows-3",
  "2x2": "grid-cols-2 grid-rows-2",
};

export function SheetManagement() {
  const { cardData, sheetCount, reorderSheet, pageSize } = useBinderContext();

  const sheets = Array.from({ length: sheetCount }, (_, i) => ({
    id: `sheet-${i}`,
    index: i,
  }));

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = sheets.findIndex((s) => s.id === active.id);
    const newIndex = sheets.findIndex((s) => s.id === over.id);

    reorderSheet(oldIndex, newIndex);
  };

  return (
    <div className="flex flex-col items-center gap-4 max-w-4xl mx-auto p-4">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">
          <FormattedMessage
            id="binder.sheet.management.title"
            defaultMessage="Manage Sheets"
          />
        </h2>
        <p className="text-muted-foreground text-sm">
          <FormattedMessage
            id="binder.sheet.management.description"
            defaultMessage="Add, remove, or reorder sheets in your binder"
          />
        </p>
      </div>

      <div className="text-center mb-4">
        <p className="text-sm text-muted-foreground">
          <FormattedMessage
            id="binder.sheet.management.stats"
            defaultMessage="This binder currently has {sheetCount} sheets ({pageCount} pages) holding a potential total of {maxCardCount} cards."
            values={{
              sheetCount,
              pageCount: sheetCount * 2,
              maxCardCount: sheetCount * 2 * pageSize,
            }}
          />
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sheets} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {/* Insert button at top */}
            <InsertSheetButton position={0} />

            {sheets.map((sheet, index) => (
              <React.Fragment key={sheet.id}>
                <SortableSheet
                  id={sheet.id}
                  sheetIndex={sheet.index}
                  cardData={cardData}
                />
                {/* Insert button after each sheet */}
                <InsertSheetButton position={index + 1} />
              </React.Fragment>
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeId ? (
            <SheetPreview
              sheetIndex={sheets.findIndex((s) => s.id === activeId)}
              cardData={cardData}
              isDragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function SortableSheet({
  id,
  sheetIndex,
  cardData,
}: {
  id: string;
  sheetIndex: number;
  cardData: any[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <SheetPreview
        sheetIndex={sheetIndex}
        cardData={cardData}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function SheetPreview({
  sheetIndex,
  cardData,
  dragHandleProps,
  isDragging = false,
}: {
  sheetIndex: number;
  cardData: BinderCardData[];
  dragHandleProps?: any;
  isDragging?: boolean;
}) {
  const intl = useIntl();
  const { sheetCount, deleteSheet, pageSize, form } = useBinderContext();

  const binderLayout = (form.watch("binderLayout") ?? "3x3") as BinderLayout;

  // Calculate page indices for this sheet
  const frontPageIndex = sheetIndex * 2;
  const backPageIndex = sheetIndex * 2 + 1;

  // Get cards for each page
  const getFrontPageCards = () => {
    const start = frontPageIndex * pageSize;
    const cards: (BinderCard | null | undefined)[] = [];
    for (let i = 0; i < pageSize; i++) {
      const cardEntry = cardData.find((cd) => cd.order === start + i);
      cards.push(cardEntry?.card);
    }
    return cards;
  };

  const getBackPageCards = () => {
    const start = backPageIndex * pageSize;
    const cards: (BinderCard | null | undefined)[] = [];
    for (let i = 0; i < pageSize; i++) {
      const cardEntry = cardData.find((cd) => cd.order === start + i);
      cards.push(cardEntry?.card);
    }
    return cards;
  };

  const frontCards = getFrontPageCards();
  const backCards = getBackPageCards();

  const hasCards = [...frontCards, ...backCards].some(Boolean);
  const gridClass = GRID_CLASSES[binderLayout];

  return (
    <div
      className={`border rounded-lg p-4 bg-card ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Drag handle */}
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          >
            <GripVertical className="h-6 w-6" />
          </div>
        )}

        {/* Visual preview of both pages */}
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="text-xs text-center text-muted-foreground mb-1 whitespace-nowrap">
              <FormattedMessage
                id="binder.sheet.label.front"
                defaultMessage="Front Site"
              />
            </div>
            <MiniPage cards={frontCards} gridClass={gridClass} />
          </div>

          <div className="flex-1">
            <div className="text-xs text-center text-muted-foreground mb-1 whitespace-nowrap">
              <FormattedMessage
                id="binder.sheet.label.back"
                defaultMessage="Back Site"
              />
            </div>
            <MiniPage cards={backCards} gridClass={gridClass} />
          </div>
        </div>

        {hasCards ? (
          <ConfirmButton
            variant="destructive"
            size="sm"
            onClick={() => deleteSheet(sheetIndex)}
            className="shrink-0"
            disabled={sheetCount <= 1}
            title={intl.formatMessage({
              id: "binder.sheet.delete.confirm.title",
              defaultMessage: "Delete Sheet with Cards",
            })}
            description={intl.formatMessage({
              id: "binder.sheet.delete.confirm.description",
              defaultMessage:
                "This sheet contains cards. Are you sure you want to delete it? The cards will be removed from this binder (but not from your collection).",
            })}
            destructive
          >
            <Trash2 className="h-6 w-6" />
          </ConfirmButton>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteSheet(sheetIndex)}
            className="shrink-0"
            disabled={sheetCount <= 1}
          >
            <Trash2 className="h-6 w-6" />
          </Button>
        )}
      </div>
    </div>
  );
}

function MiniPage({
  cards,
  gridClass,
}: {
  cards: (BinderCard | null | undefined)[];
  gridClass: string;
}) {
  return (
    <div className="border border-gray-300 rounded p-1 bg-background">
      <div className={`grid ${gridClass} gap-0.5`}>
        {cards.map((card, i) => (
          <div
            key={i}
            className={`${CARD_ASPECT_CLASS} bg-muted overflow-hidden flex items-center justify-center`}
            style={{ borderRadius: CARD_BORDER_RADIUS }}
          >
            {card?.image ? (
              <Image
                src={card.image}
                alt={card.name}
                width={21}
                height={28}
                className="w-5.5 h-auto object-cover"
              />
            ) : (
              <div className="w-5.5 h-auto bg-muted" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function InsertSheetButton({ position }: { position: number }) {
  const { insertSheet } = useBinderContext();

  return (
    <div className="flex items-center justify-center">
      <Button
        variant="outline"
        size="sm"
        onClick={() => insertSheet(position)}
        className="gap-2"
      >
        <BetweenHorizonalStart className="h-3 w-3" />
        <span className="">
          <FormattedMessage
            id="binder.sheet.action.insert"
            defaultMessage="Insert Sheet Here"
          />
        </span>
      </Button>
    </div>
  );
}
