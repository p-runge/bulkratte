"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import pokemonAPI from "@/lib/pokemon-api";
import { FormattedMessage } from "react-intl";

interface VariantToggleGroupProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  includeNone?: boolean;
}

export function VariantToggleGroup({
  value,
  onValueChange,
  includeNone = false,
}: VariantToggleGroupProps) {
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
          <FormattedMessage
            id="toggle-group-option.none"
            defaultMessage="None"
          />
        </ToggleGroupItem>
      )}
      {pokemonAPI.getVariants("").map((variant) => (
        <ToggleGroupItem
          key={variant}
          value={variant}
          variant="outline"
          className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {variant}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
