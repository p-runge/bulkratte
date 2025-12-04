"use client"

import { CardBrowser } from "@/components/card-browser";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api/react";
import {
  conditionEnum,
  languageEnum, variantEnum
} from "@/lib/db/enums";
import { RHFForm, useRHFForm } from "@/lib/form/utils";
import Image from "next/image";
import { useState } from "react";
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
    }
  );
  const { mutateAsync: addCardToCollection } = api.userCard.create.useMutation();
  const apiUtils = api.useUtils();

  const form = useRHFForm(FormSchema, {
    defaultValues: {
      condition: "Near Mint",
      language: "en",
      variant: "Unlimited",
      // notes: "",
      // photos: [],
    },
  })

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
      <DialogContent className="max-h-[90vh] w-3xl sm:max-w-screen">
        <DialogHeader>
          <DialogTitle>
            {intl.formatMessage({
              id: "collection.cards.create.title",
              defaultMessage: "Add New Card",
            })}
          </DialogTitle>
        </DialogHeader>
        {/* TODO: add default settings here (language, condition, variant, etc.) */}
        <RHFForm form={form} onSubmit={handleSubmit} className="py-4">
          {!selectedCardId ? <CardBrowser selectionMode="single" onCardClick={(cardId) => setSelectedCardId(cardId)} maxHeightGrid="400px" /> :
            card ? (
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
                <div>
                  <h2 className="text-2xl font-bold mb-2">
                    {card.name}
                  </h2>
                  {/* TODO: Additional form fields for language, condition, variant, etc. would go here respecting default settings */}
                  {/* <Controller
                      name="variant"
                      control={form.control}
                      render={({ field }) => (
                        <>
                          <Label className="mb-2 block font-medium">
                            {intl.formatMessage({
                              id: "collection.cards.form.variantLabel",
                              defaultMessage: "Variant",
                            })}
                          </Label>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="mb-4 w-60">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {variantEnum.enumValues.map((variant) => (
                                <SelectItem key={variant} value={variant}>
                                  {variant}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-sm text-red-600 mt-1">
                            {form.formState.errors.variant?.message ?? "\u00A0"}
                          </p>
                        </>
                      )}
                    />
                    <Controller
                      name="condition"
                      control={form.control}
                      render={({ field }) => (
                        <>
                          <Label className="mb-2 block font-medium">
                            {intl.formatMessage({
                              id: "collection.cards.form.conditionLabel",
                              defaultMessage: "Condition",
                            })}
                          </Label>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="mb-4 w-60">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {conditionEnum.enumValues.map((condition) => (
                                <SelectItem key={condition} value={condition}>
                                  {condition}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-sm text-red-600 mt-1">
                            {form.formState.errors.condition?.message ?? "\u00A0"}
                          </p>
                        </>
                      )}
                    />
                    <Controller
                      name="language"
                      control={form.control}
                      render={({ field }) => (
                        <>
                          <Label className="mb-2 block font-medium">
                            {intl.formatMessage({
                              id: "collection.cards.form.languageLabel",
                              defaultMessage: "Language",
                            })}
                          </Label>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="mb-4 w-60">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {languageEnum.enumValues.map((language) => (
                                <SelectItem key={language} value={language}>
                                  {language}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-sm text-red-600 mt-1">
                            {form.formState.errors.language?.message ?? "\u00A0"}
                          </p>
                        </>
                      )}
                    /> */}
                </div>
              </div>
            ) : (
              // loading skeleton
              <div className="w-60 h-84 bg-muted animate-pulse rounded-md" />
            )}

          {selectedCardId && <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={!card}>
              {intl.formatMessage({
                id: "collection.cards.create.cancelButton",
                defaultMessage: "Cancel",
              })}
            </Button>
            <Button type="submit" disabled={!card}>
              {intl.formatMessage({
                id: "collection.cards.create.addButton",
                defaultMessage: "Add Card to Collection",
              })}
            </Button>
          </DialogFooter>}
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
})
