"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import pokemonAPI from "@/lib/pokemon-api";
import { ConditionBadge } from "./condition-badge";

interface ConditionToggleGroupProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  includeNone?: boolean;
}

export function ConditionToggleGroup({
  value,
  onValueChange,
  includeNone = false,
}: ConditionToggleGroupProps) {
  return (
    <ToggleGroup
      type="single"
      value={value ?? (includeNone ? "none" : "")}
      onValueChange={(newValue) => {
        if (includeNone) {
          onValueChange(newValue === "none" ? null : newValue);
        } else {
          if (newValue && newValue !== value) {
            onValueChange(newValue);
          }
        }
      }}
    >
      {includeNone && (
        <ToggleGroupItem
          value="none"
          variant="outline"
          className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          None
        </ToggleGroupItem>
      )}
      {pokemonAPI.conditions.map((condition) => (
        <ToggleGroupItem
          key={condition.value}
          value={condition.value}
          variant="outline"
          className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          title={condition.value}
        >
          <ConditionBadge condition={condition.value} />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
