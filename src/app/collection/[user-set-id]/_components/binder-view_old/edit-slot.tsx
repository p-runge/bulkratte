import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import Image from "next/image";
import { MinimalCardData } from "../edit-set-content";

interface EditSlotProps {
  card: MinimalCardData | null;
  onRemove: () => void;
  onAdd: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragging: boolean;
}

export function EditSlot({
  card,
  onRemove,
  onAdd,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
}: EditSlotProps) {
  if (!card) {
    return (
      <div
        className={cn(
          "aspect-[2.5/3.5] bg-muted/30 rounded border-2 border-dashed border-muted-foreground/20",
          "flex items-center justify-center group hover:border-primary/50 transition-colors",
        )}
        onDragOver={onDragOver}
        onDrop={onDrop}
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

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "aspect-[2.5/3.5] rounded relative group cursor-move",
        isDragging && "opacity-50",
      )}
    >
      <Image
        src={card.imageSmall}
        alt={card.name}
        width={200}
        height={280}
        unoptimized
        className="w-full h-full object-contain rounded"
      />
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
