"use client";

import { ConditionToggleGroup } from "@/components/condition-toggle-group";
import { LanguageToggleGroup } from "@/components/language-toggle-group";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { VariantToggleGroup } from "@/components/variant-toggle-group";
import { conditionEnum, languageEnum, variantEnum } from "@/lib/db/enums";
import { RHFForm, useRHFForm } from "@/lib/form/utils";
import Image from "next/image";
import { Controller } from "react-hook-form";
import { FormattedMessage, useIntl } from "react-intl";
import z from "zod";
import { BinderCard } from "./types";

const FormSchema = z.object({
  preferredLanguage: z.enum(languageEnum.enumValues).nullable(),
  preferredVariant: z.enum(variantEnum.enumValues).nullable(),
  preferredCondition: z.enum(conditionEnum.enumValues).nullable(),
});

interface CardPreferencesDialogProps {
  card: BinderCard;
  position: number;
  currentPreferences: {
    preferredLanguage:
      | (typeof languageEnum.enumValues)[number]
      | null
      | undefined;
    preferredVariant:
      | (typeof variantEnum.enumValues)[number]
      | null
      | undefined;
    preferredCondition:
      | (typeof conditionEnum.enumValues)[number]
      | null
      | undefined;
  };
  setLevelPreferences: {
    preferredLanguage:
      | (typeof languageEnum.enumValues)[number]
      | null
      | undefined;
    preferredVariant:
      | (typeof variantEnum.enumValues)[number]
      | null
      | undefined;
    preferredCondition:
      | (typeof conditionEnum.enumValues)[number]
      | null
      | undefined;
  };
  onSave: (preferences: {
    preferredLanguage:
      | (typeof languageEnum.enumValues)[number]
      | null
      | undefined;
    preferredVariant:
      | (typeof variantEnum.enumValues)[number]
      | null
      | undefined;
    preferredCondition:
      | (typeof conditionEnum.enumValues)[number]
      | null
      | undefined;
  }) => void;
  onClose: () => void;
}

export function CardPreferencesDialog({
  card,
  position,
  currentPreferences,
  setLevelPreferences,
  onSave,
  onClose,
}: CardPreferencesDialogProps) {
  const form = useRHFForm(FormSchema, {
    defaultValues: {
      preferredLanguage: currentPreferences.preferredLanguage ?? null,
      preferredVariant: currentPreferences.preferredVariant ?? null,
      preferredCondition: currentPreferences.preferredCondition ?? null,
    },
  });

  async function handleSubmit(data: z.infer<typeof FormSchema>) {
    onSave({
      preferredLanguage: data.preferredLanguage,
      preferredVariant: data.preferredVariant,
      preferredCondition: data.preferredCondition,
    });
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose} modal>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            <FormattedMessage
              id="dialog.card_preferences.title"
              defaultMessage="Card Preferences"
            />
          </DialogTitle>
        </DialogHeader>

        <RHFForm form={form} onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Image
                src={card.imageSmall}
                alt={card.name}
                width={80}
                height={110}
                unoptimized
                className="rounded border"
              />
              <div>
                <h3 className="font-semibold">{card.name}</h3>
                <p className="text-sm text-muted-foreground">
                  <FormattedMessage
                    id="dialog.card_preferences.position"
                    defaultMessage="Position {position}"
                    values={{ position: position + 1 }}
                  />
                </p>
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                <FormattedMessage
                  id="dialog.card_preferences.description"
                  defaultMessage="Set preferences for this specific card. These will override the set-level preferences."
                />
              </p>

              {/* Language Field */}
              <div className="space-y-2">
                <Label>
                  <FormattedMessage
                    id="form.field.language.label"
                    defaultMessage="Language"
                  />
                  {setLevelPreferences.preferredLanguage && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      (
                      <FormattedMessage
                        id="dialog.card_preferences.set_default"
                        defaultMessage="Set default: {value}"
                        values={{
                          value: setLevelPreferences.preferredLanguage,
                        }}
                      />
                      )
                    </span>
                  )}
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
              </div>

              {/* Variant Field */}
              <div className="space-y-2">
                <Label>
                  <FormattedMessage
                    id="form.field.variant.label"
                    defaultMessage="Variant"
                  />
                  {setLevelPreferences.preferredVariant && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      (
                      <FormattedMessage
                        id="dialog.card_preferences.set_default"
                        defaultMessage="Set default: {value}"
                        values={{
                          value: setLevelPreferences.preferredVariant,
                        }}
                      />
                      )
                    </span>
                  )}
                </Label>
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
              </div>

              {/* Condition Field */}
              <div className="space-y-2">
                <Label>
                  <FormattedMessage
                    id="form.field.condition.label"
                    defaultMessage="Condition"
                  />
                  {setLevelPreferences.preferredCondition && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      (
                      <FormattedMessage
                        id="dialog.card_preferences.set_default"
                        defaultMessage="Set default: {value}"
                        values={{
                          value: setLevelPreferences.preferredCondition,
                        }}
                      />
                      )
                    </span>
                  )}
                </Label>
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
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              <FormattedMessage
                id="common.button.cancel"
                defaultMessage="Cancel"
              />
            </Button>
            <Button type="submit">
              <FormattedMessage id="common.button.save" defaultMessage="Save" />
            </Button>
          </DialogFooter>
        </RHFForm>
      </DialogContent>
    </Dialog>
  );
}
