import { BinderCard } from "./types";

export default function CardSlot({ card }: { card: BinderCard | null }) {
  if (!card) {
    return (
      <div className="aspect-[2.5/3.5] bg-gray-100 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 text-xs">
        Empty
      </div>
    );
  }

  return (
    <div className="aspect-[2.5/3.5] bg-gray-200 border border-gray-400 rounded flex items-center justify-center text-xs font-medium">
      {card.name}
    </div>
  );
}
