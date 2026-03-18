"use client";

import { ConditionToggleGroup } from "@/components/condition-toggle-group";
import { LanguageToggleGroup } from "@/components/language-toggle-group";
import { VariantToggleGroup } from "@/components/variant-toggle-group";
import { Label } from "@/components/ui/label";
import { type Control } from "react-hook-form";
import { Controller } from "react-hook-form";
import { useIntl } from "react-intl";

interface UserCardFormFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
}

export function UserCardFormFields({ control }: UserCardFormFieldsProps) {
  const intl = useIntl();

  return (
    <>
      <div className="space-y-2">
        <Label>
          {intl.formatMessage({
            id: "form.field.language.label",
            defaultMessage: "Language",
          })}
        </Label>
        <Controller
          control={control}
          name="language"
          render={({ field }) => (
            <LanguageToggleGroup
              value={field.value ?? null}
              onValueChange={field.onChange}
              includeNone
            />
          )}
        />
      </div>

      <div className="space-y-2">
        <Label>
          {intl.formatMessage({
            id: "form.field.variant.label",
            defaultMessage: "Variant",
          })}
        </Label>
        <Controller
          control={control}
          name="variant"
          render={({ field }) => (
            <VariantToggleGroup
              value={field.value ?? null}
              onValueChange={field.onChange}
              includeNone
            />
          )}
        />
      </div>

      <div className="space-y-2">
        <Label>
          {intl.formatMessage({
            id: "form.field.condition.label",
            defaultMessage: "Condition",
          })}
        </Label>
        <Controller
          control={control}
          name="condition"
          render={({ field }) => (
            <ConditionToggleGroup
              value={field.value ?? null}
              onValueChange={field.onChange}
              includeNone
            />
          )}
        />
      </div>
    </>
  );
}
