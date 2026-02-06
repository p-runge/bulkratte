"use client";

import { CardBrowser } from "@/components/card-browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api/react";
import { conditionEnum, languageEnum, variantEnum } from "@/lib/db/enums";
import { RHFForm, useRHFForm } from "@/lib/form/utils";
import pokemonAPI from "@/lib/pokemon-api";
import Image from "next/image";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { useIntl } from "react-intl";
import z from "zod";

export default function CreateUserCardDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const intl = useIntl();

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const { data: card } = api.card.getById.useQuery(
    { cardId: selectedCardId! },
    {
      enabled: !!selectedCardId,
    },
  );
  const { mutateAsync: addCardToCollection } =
    api.userCard.create.useMutation();
  const apiUtils = api.useUtils();

  const form = useRHFForm(FormSchema, {
    defaultValues: {
      condition: "Near Mint",
      language: "en",
      variant: "Unlimited",
      // notes: "",
      // photos: [],
    },
  });

  async function handleSubmit(data: z.infer<typeof FormSchema>) {
    if (!card) {
      return;
    }

    await addCardToCollection({
      cardId: card.id,
      condition: data.condition,
      language: data.language,
      variant: data.variant,
      // notes: data.notes,
      // photos: data.photos,
    });
    await apiUtils.userCard.getList.invalidate();

    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose} modal>
      <DialogContent className="max-h-[90vh] w-5xl sm:max-w-screen">
        <DialogHeader>
          <DialogTitle>
            {intl.formatMessage({
              id: "dialog.create_card.title",
              defaultMessage: "Add New Card",
            })}
          </DialogTitle>
        </DialogHeader>
        {/* TODO: add default settings here (language, condition, variant, etc.) */}
        <RHFForm form={form} onSubmit={handleSubmit} className="py-4">
          {!selectedCardId ? (
            <CardBrowser
              selectionMode="single"
              onCardClick={(cardId) => setSelectedCardId(cardId)}
              maxHeightGrid="600px"
            />
          ) : card ? (
            <div className="flex gap-6">
              <Image
                src={card.imageSmall}
                alt={card.name}
                width={240}
                height={165}
                unoptimized
                className="w-auto h-auto object-contain rounded-md"
                draggable={false}
                priority
              />
              <div className="flex-1 space-y-6">
                <h2 className="text-2xl font-bold mb-4">{card.name}</h2>

                {/* Variant Field */}
                <div className="space-y-2">
                  <Label>
                    {intl.formatMessage({
                      id: "form.field.variant.label",
                      defaultMessage: "Variant",
                    })}
                  </Label>
                  <Controller
                    control={form.control}
                    name="variant"
                    render={({ field }) => (
                      <ToggleGroup
                        type="single"
                        value={field.value}
                        onValueChange={(value) => {
                          if (value) field.onChange(value);
                        }}
                      >
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
                    )}
                  />
                </div>

                {/* Condition Field */}
                <div className="space-y-2">
                  <Label>
                    {intl.formatMessage({
                      id: "form.field.condition.label",
                      defaultMessage: "Condition",
                    })}
                  </Label>
                  <Controller
                    control={form.control}
                    name="condition"
                    render={({ field }) => (
                      <ToggleGroup
                        type="single"
                        value={field.value}
                        onValueChange={(value) => {
                          if (value) field.onChange(value);
                        }}
                      >
                        {pokemonAPI.conditions.map((condition) => (
                          <ToggleGroupItem
                            key={condition.value}
                            value={condition.value}
                            variant="outline"
                            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                            title={condition.value}
                          >
                            <Badge className={`${condition.color} border`}>
                              {condition.short}
                            </Badge>
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    )}
                  />
                </div>

                {/* Language Field */}
                <div className="space-y-2">
                  <Label>
                    {intl.formatMessage({
                      id: "form.field.language.label",
                      defaultMessage: "Language",
                    })}
                  </Label>
                  <Controller
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <ToggleGroup
                        type="single"
                        value={field.value}
                        onValueChange={(value) => {
                          if (value) field.onChange(value);
                        }}
                      >
                        {pokemonAPI.cardLanguages.map((language) => (
                          <ToggleGroupItem
                            key={language.code}
                            value={language.code}
                            variant="outline"
                            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground text-2xl"
                            title={language.name}
                          >
                            {language.flag}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    )}
                  />
                </div>
              </div>
            </div>
          ) : (
            // loading skeleton
            <div className="w-60 h-84 bg-muted animate-pulse rounded-md" />
          )}

          {selectedCardId && (
            <DialogFooter>
              <Button variant="ghost" onClick={onClose} disabled={!card}>
                {intl.formatMessage({
                  id: "common.button.cancel",
                  defaultMessage: "Cancel",
                })}
              </Button>
              <Button type="submit" disabled={!card}>
                {intl.formatMessage({
                  id: "dialog.create_card.button.add",
                  defaultMessage: "Add Card to Collection",
                })}
              </Button>
            </DialogFooter>
          )}
        </RHFForm>
      </DialogContent>
    </Dialog>
  );
}

const FormSchema = z.object({
  condition: z.enum(conditionEnum.enumValues),
  language: z.enum(languageEnum.enumValues),
  variant: z.enum(variantEnum.enumValues),
  // notes: z.string(),
  // photos: z.array(z.string().url()),
});
