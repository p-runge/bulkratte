import { Badge } from "@/components/ui/badge";
import pokemonAPI, { Condition } from "@/lib/pokemon-api";

interface ConditionBadgeProps {
  condition: Condition["value"];
  className?: string;
}

export function ConditionBadge({
  condition: value,
  className,
}: ConditionBadgeProps) {
  const condition = pokemonAPI.getConditionInfo(value);

  return (
    <Badge
      title={condition.value}
      className={`${condition.color} border text-xs pointer-events-none ${className ?? ""}`}
    >
      {condition.short}
    </Badge>
  );
}
