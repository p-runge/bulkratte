"use client";

import { useBinderContext } from "@/components/binder/binder-context";
import { ConditionToggleGroup } from "@/components/condition-toggle-group";
import { LanguageToggleGroup } from "@/components/language-toggle-group";
import { VariantToggleGroup } from "@/components/variant-toggle-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import { Controller } from "react-hook-form";
import { FormattedMessage } from "react-intl";
import type { BinderLayout } from "@/lib/db/enums";

const LAYOUT_OPTIONS: { value: BinderLayout; columns: number; rows: number }[] =
  [
    { value: "2x2", columns: 2, rows: 2 },
    { value: "3x3", columns: 3, rows: 3 },
    { value: "4x3", columns: 4, rows: 3 },
  ];

function LayoutPreview({ columns, rows }: { columns: number; rows: number }) {
  return (
    <div
      className="grid gap-0.5"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {Array.from({ length: columns * rows }).map((_, i) => (
        <div
          key={i}
          className="w-2.5 aspect-[2.5/3.5] rounded-[1px] bg-current opacity-60"
        />
      ))}
    </div>
  );
}

export function PreferredProperties() {
  const { form } = useBinderContext();

  return (
    <>
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          <FormattedMessage
            id="preferred_properties.label"
            defaultMessage="Preferences"
          />
        </Label>

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

      <div className="space-y-2">
        <Label className="text-sm font-medium">
          <FormattedMessage
            id="preferred_properties.binder_layout.label"
            defaultMessage="Binder Layout"
          />
        </Label>
        <Controller
          control={form.control}
          name="binderLayout"
          render={({ field }) => (
            <ToggleGroup
              type="single"
              value={field.value ?? "3x3"}
              onValueChange={(v) => {
                if (v) field.onChange(v);
              }}
              className="justify-start gap-2"
            >
              {LAYOUT_OPTIONS.map(({ value, columns, rows }) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  aria-label={value}
                  className="flex flex-col items-center gap-1.5 h-auto px-3 py-2"
                >
                  <LayoutPreview columns={columns} rows={rows} />
                  <span className="text-xs font-medium">{value}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        />
      </div>
    </>
  );
}
