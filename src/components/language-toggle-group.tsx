"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import pokemonAPI from "@/lib/pokemon-api";
import { LanguageBadge } from "./language-badge";

interface LanguageToggleGroupProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  includeNone?: boolean;
}

export function LanguageToggleGroup({
  value,
  onValueChange,
  includeNone = false,
}: LanguageToggleGroupProps) {
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
      {pokemonAPI.cardLanguages.map((language) => (
        <ToggleGroupItem
          key={language.code}
          value={language.code}
          variant="outline"
          className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground text-2xl"
          title={language.name}
        >
          <LanguageBadge code={language.code} />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
