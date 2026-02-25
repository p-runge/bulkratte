"use client";

import { ConditionBadge } from "@/components/condition-badge";
import { LanguageBadge } from "@/components/language-badge";
import Loader from "@/components/loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { type RouterOutputs, api } from "@/lib/api/react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, LayoutGridIcon, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";

type UserSet = RouterOutputs["userSet"]["getList"][number];

function SortableSetCard({ userSet }: { userSet: UserSet }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: userSet.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <Link href={`/collection/${userSet.id}`} className="block">
        <Card className="relative hover:shadow-lg transition-shadow h-full">
          <CardContent>
            <div className="flex gap-4">
              {userSet.image && (
                <div className="w-24 h-24 sm:w-12 sm:h-12 xl:w-24 xl:h-24 shrink-0">
                  <img
                    src={userSet.image}
                    alt={userSet.name}
                    className="w-full h-full object-contain rounded border"
                  />
                </div>
              )}
              <div className="flex-1">
                <CardTitle className="text-lg mb-2">{userSet.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <LayoutGridIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {userSet.placedCards}/{userSet.totalCards}
                  </span>
                </div>
              </div>
            </div>

            {/* Badge stack in top right corner */}
            <div className="absolute -top-3 -right-3 flex flex-row items-center gap-1">
              {userSet.preferredLanguage && (
                <Badge variant="outline" className="h-5.5 bg-background">
                  <LanguageBadge
                    code={userSet.preferredLanguage}
                    className="text-lg shadow-md"
                  />
                </Badge>
              )}
              {userSet.preferredVariant && (
                <Badge variant="outline" className="bg-background">
                  {userSet.preferredVariant}
                </Badge>
              )}
              {userSet.preferredCondition && (
                <ConditionBadge
                  condition={userSet.preferredCondition}
                  className="shadow-md"
                />
              )}
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Drag handle — sits on top of the link so it intercepts pointer events */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        onClick={(e) => e.preventDefault()}
      >
        <GripVertical className="h-4 w-4" />
      </div>
    </div>
  );
}

export default function MySetsTab() {
  const intl = useIntl();

  const { data, isLoading } = api.userSet.getList.useQuery();
  const [items, setItems] = useState<UserSet[]>([]);

  useEffect(() => {
    if (data) setItems(data);
  }, [data]);

  const reorderMutation = api.userSet.reorder.useMutation();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      reorderMutation.mutate({ ids: next.map((s) => s.id) });
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="flex justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <TabsContent value="collections">
      <div className="mb-6 flex justify-end">
        <Link href="/collection/new-set">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            {intl.formatMessage({
              id: "page.collection.action.add_set",
              defaultMessage: "Add New Set",
            })}
          </Button>
        </Link>
      </div>
      {items.length === 0 ? (
        // No sets
        <Card className="text-center py-12">
          <CardContent>
            <h3 className="text-lg font-semibold mb-2">
              {intl.formatMessage({
                id: "page.collection.sets.empty.title",
                defaultMessage: "No sets added yet",
              })}
            </h3>
            <p className="mb-6 text-muted-foreground">
              {intl.formatMessage({
                id: "page.collection.sets.empty.description",
                defaultMessage: "Add your first set!",
              })}
            </p>
            <Link href="/collection/new-set">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                {intl.formatMessage({
                  id: "page.collection.action.add_first_set",
                  defaultMessage: "Add Your First Set",
                })}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        // Sortable grid
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((s) => s.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((userSet) => (
                <SortableSetCard key={userSet.id} userSet={userSet} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </TabsContent>
  );
}
