"use client";

import { useBinderContext } from "@/components/binder/binder-context";
import { ConditionToggleGroup } from "@/components/condition-toggle-group";
import { LanguageToggleGroup } from "@/components/language-toggle-group";
import { VariantToggleGroup } from "@/components/variant-toggle-group";
import { Label } from "@/components/ui/label";
import { Controller } from "react-hook-form";

export function PreferredProperties() {
  const { form } = useBinderContext();

  return (
    <>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Preferences</Label>

        {/* Language Selector */}
        <Controller
          control={form.control}
          name="preferredLanguage"
          render={({ field }) => (
            <LanguageToggleGroup
              value={field.value}
              onValueChange={field.onChange}
              includeNone
            />
          )}
        />

        {/* Variant Selector */}
        <Controller
          control={form.control}
          name="preferredVariant"
          render={({ field }) => (
            <VariantToggleGroup
              value={field.value}
              onValueChange={field.onChange}
              includeNone
            />
          )}
        />

        {/* Condition Selector */}
        <Controller
          control={form.control}
          name="preferredCondition"
          render={({ field }) => (
            <ConditionToggleGroup
              value={field.value}
              onValueChange={field.onChange}
              includeNone
            />
          )}
        />
      </div>
    </>
  );
}
