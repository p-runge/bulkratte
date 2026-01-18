import { cn } from "@/lib/utils";
import { BinderCard } from "./types";
import { Button } from "../ui/button";
import { Plus } from "lucide-react";
import { useBinderContext } from "./binder-context";

export default function CardSlot({
  card,
  position,
}: {
  card: BinderCard | null;
  position: number;
}) {
  if (!card) {
    return <EmptyCardSlot position={position} />;
  }

  return (
    <div className="aspect-[2.5/3.5] bg-gray-200 border border-gray-400 rounded flex items-center justify-center text-xs font-medium">
      {card.name}
    </div>
  );
}

function EmptyCardSlot({ position }: { position: number }) {
  const { pickCardsForPosition } = useBinderContext();

  const onAdd = () => {
    pickCardsForPosition(position);
  };

  return (
    <div
      className={cn(
        "aspect-[2.5/3.5] bg-muted/30 rounded border-2 border-dashed border-muted-foreground/20",
        "flex items-center justify-center group hover:border-primary/50 transition-colors",
      )}
      // onDragOver={onDragOver}
      // onDrop={onDrop}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onAdd}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}
