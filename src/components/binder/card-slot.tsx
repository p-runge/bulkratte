import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import Image from "next/image";
import { Button } from "../ui/button";
import { useBinderContext } from "./binder-context";
import { BinderCard } from "./types";

export default function CardSlot({
  card,
  position,
}: {
  card: BinderCard | null | undefined;
  position: number;
}) {
  if (card === null) {
    return <EmptyCardSlot position={position} />;
  }

  return (
    <div className="w-full max-w-full max-h-full aspect-245/337 border border-gray-400 rounded flex items-center justify-center text-xs font-medium relative overflow-hidden">
      {card ? (
        <Image
          src={card.imageSmall}
          alt={card.name}
          width={245}
          height={337}
          unoptimized
          className="w-full h-full object-contain rounded"
        />
      ) : (
        <div className="w-full h-full bg-gray-200 animate-pulse rounded" />
      )}
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function EmptyCardSlot({ position }: { position: number }) {
  const { pickCardsForPosition } = useBinderContext();

  const onAdd = () => {
    pickCardsForPosition(position);
  };

  return (
    <Button
      variant="link"
      onClick={onAdd}
      className={cn(
        "group aspect-245/337 p-0",
        "bg-muted/30 rounded border-2 border-dashed border-muted-foreground/20",
        "hover:border-primary/50 transition-colors",
      )}
    >
      <Plus className="h-6 w-6 opacity-20 group-hover:opacity-100 transition-opacity" />
    </Button>
  );
}
