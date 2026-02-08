"use client";

import { useState } from "react";
import { Controller } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { useBinderContext } from "@/components/binder/binder-context";
import { variantEnum } from "@/lib/db/enums";
import pokemonAPI from "@/lib/pokemon-api";
import { ChevronDown } from "lucide-react";

export function PreferredProperties() {
  const [isOpen, setIsOpen] = useState(false);
  const { form } = useBinderContext();

  const preferredLanguage = form.watch("preferredLanguage");
  const preferredVariant = form.watch("preferredVariant");
  const preferredCondition = form.watch("preferredCondition");

  const hasAnyPreferred =
    preferredLanguage || preferredVariant || preferredCondition;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:underline">
        <span>Preferred Card Properties</span>
        {hasAnyPreferred && (
          <Badge variant="outline" className="ml-1">
            {
              [preferredLanguage, preferredVariant, preferredCondition].filter(
                Boolean,
              ).length
            }
          </Badge>
        )}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 space-y-4">
        {/* Language Selector */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Preferred Language</Label>
          <p className="text-xs text-muted-foreground">
            Select a preferred language for cards in this set
          </p>
          <Controller
            control={form.control}
            name="preferredLanguage"
            render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={field.value === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => field.onChange(null)}
                >
                  None
                </Button>
                {pokemonAPI.cardLanguages.map((lang) => (
                  <Button
                    key={lang.code}
                    type="button"
                    variant={field.value === lang.code ? "default" : "outline"}
                    size="sm"
                    onClick={() => field.onChange(lang.code)}
                    className="flex items-center gap-2"
                  >
                    <span className="text-base">{lang.flag}</span>
                    <span>{lang.name}</span>
                  </Button>
                ))}
              </div>
            )}
          />
        </div>

        {/* Variant Selector */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Preferred Variant</Label>
          <p className="text-xs text-muted-foreground">
            Select a preferred variant for cards in this set
          </p>
          <Controller
            control={form.control}
            name="preferredVariant"
            render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={field.value === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => field.onChange(null)}
                >
                  None
                </Button>
                {variantEnum.enumValues.map((variant) => (
                  <Button
                    key={variant}
                    type="button"
                    variant={field.value === variant ? "default" : "outline"}
                    size="sm"
                    onClick={() => field.onChange(variant)}
                  >
                    {variant}
                  </Button>
                ))}
              </div>
            )}
          />
        </div>

        {/* Condition Selector */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Preferred Condition</Label>
          <p className="text-xs text-muted-foreground">
            Select a preferred condition for cards in this set
          </p>
          <Controller
            control={form.control}
            name="preferredCondition"
            render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={field.value === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => field.onChange(null)}
                >
                  None
                </Button>
                {pokemonAPI.conditions.map((condition) => (
                  <Button
                    key={condition.value}
                    type="button"
                    variant={
                      field.value === condition.value ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => field.onChange(condition.value)}
                    className="flex items-center gap-2"
                  >
                    <Badge
                      className={`${condition.color} border text-xs pointer-events-none`}
                    >
                      {condition.short}
                    </Badge>
                    <span>{condition.value}</span>
                  </Button>
                ))}
              </div>
            )}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
