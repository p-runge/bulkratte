"use client";

import type { UserCard } from "@/components/binder/types";
import { CardBrowser } from "@/components/card-browser";
import { ConditionToggleGroup } from "@/components/condition-toggle-group";
import ConfirmButton from "@/components/confirm-button";
import { LanguageToggleGroup } from "@/components/language-toggle-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { api } from "@/lib/api/react";
import { conditionEnum, languageEnum, variantEnum } from "@/lib/db/enums";
import { RHFForm, useRHFForm } from "@/lib/form/utils";
import { Info, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { useIntl } from "react-intl";
import z from "zod";

type UserCardDialogProps = {
  mode: "create" | "edit";
  userCard?: UserCard;
  onClose: () => void;
};

export default function UserCardDialog({
  mode,
  userCard,
  onClose,
}: UserCardDialogProps) {
  const intl = useIntl();

  // For create mode, we need to select a card first
  const [selectedCardId, setSelectedCardId] = useState<string | null>(
    mode === "edit" && userCard ? userCard.card.id : null,
  );

  const { data: card } = api.card.getById.useQuery(
    { cardId: selectedCardId! },
    {
      enabled: !!selectedCardId,
    },
  );

  const { mutateAsync: createUserCard } = api.userCard.create.useMutation();
  const { mutateAsync: updateUserCard } = api.userCard.update.useMutation();
  const { mutateAsync: deleteUserCard } = api.userCard.delete.useMutation();
  const apiUtils = api.useUtils();

  // Get placement status for edit mode
  const { data: placedCards } = api.userSet.getPlacedUserCardIds.useQuery(
    undefined,
    {
      enabled: mode === "edit" && !!userCard,
    },
  );

  const placement = placedCards?.find((p) => p.userCardId === userCard?.id);

  const form = useRHFForm(FormSchema, {
    defaultValues:
      mode === "edit" && userCard
        ? {
            language: userCard.language ?? null,
            variant: userCard.variant ?? null,
            condition: userCard.condition ?? null,
          }
        : {
            language: null,
            variant: null,
            condition: null,
          },
  });

  async function handleSubmit(data: z.infer<typeof FormSchema>) {
    if (!card) {
      return;
    }

    if (mode === "create") {
      await createUserCard({
        cardId: card.id,
        language: data.language ?? undefined,
        variant: data.variant ?? undefined,
        condition: data.condition ?? undefined,
      });
    } else if (mode === "edit" && userCard) {
      await updateUserCard({
        id: userCard.id,
        language: data.language,
        variant: data.variant,
        condition: data.condition,
      });
    }

    await apiUtils.userCard.getList.invalidate();
    onClose();
  }

  async function handleDelete() {
    if (!userCard) return;

    await deleteUserCard({ id: userCard.id });
    await apiUtils.userCard.getList.invalidate();
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose} modal>
      <DialogContent className="w-5xl sm:max-w-screen">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? intl.formatMessage({
                  id: "dialog.create_card.title",
                  defaultMessage: "Add New Card",
                })
              : intl.formatMessage({
                  id: "dialog.edit_card.title",
                  defaultMessage: "Edit Card",
                })}
          </DialogTitle>
        </DialogHeader>
        <RHFForm form={form} onSubmit={handleSubmit} className="flex flex-col">
          <div className="overflow-y-auto max-h-[70vh]">
            {!selectedCardId && mode === "create" ? (
              <CardBrowser
                selectionMode="single"
                onCardClick={(cardId) => setSelectedCardId(cardId)}
                maxHeightGrid="600px"
              />
            ) : card ? (
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                <Image
                  src={card.imageSmall}
                  alt={card.name}
                  width={240}
                  height={165}
                  unoptimized
                  className="w-full sm:w-auto h-auto max-w-50 sm:max-w-60 mx-auto sm:mx-0 object-contain rounded-md"
                  draggable={false}
                  priority
                />
                <div className="flex-1 space-y-4 sm:space-y-6">
                  <h2 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-4">
                    {card.name}
                  </h2>

                  {mode === "edit" && placement && (
                    <Alert>
                      <Info />
                      <AlertTitle>
                        {intl.formatMessage({
                          id: "dialog.edit_card.placed_in_set",
                          defaultMessage: "Placed in Set",
                        })}
                      </AlertTitle>
                      <AlertDescription>
                        {intl.formatMessage(
                          {
                            id: "dialog.edit_card.placed_in_set.description",
                            defaultMessage:
                              'This card is currently placed in "{setName}"',
                          },
                          { setName: placement.setName },
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

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
                        <LanguageToggleGroup
                          value={field.value ?? null}
                          onValueChange={field.onChange}
                          includeNone
                        />
                      )}
                    />
                  </div>

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
                        <VariantToggleGroup
                          value={field.value ?? null}
                          onValueChange={field.onChange}
                          includeNone
                        />
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
                        <ConditionToggleGroup
                          value={field.value ?? null}
                          onValueChange={field.onChange}
                          includeNone
                        />
                      )}
                    />
                  </div>
                </div>
              </div>
            ) : (
              // loading skeleton
              <div className="w-60 h-84 bg-muted animate-pulse rounded-md" />
            )}
          </div>

          {(selectedCardId || mode === "edit") && (
            <DialogFooter className="flex justify-between items-center pt-4">
              <div>
                {mode === "edit" && (
                  <ConfirmButton
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={!card}
                    destructive
                    title={intl.formatMessage({
                      id: "dialog.edit_card.confirm_delete.title",
                      defaultMessage: "Delete Card",
                    })}
                    description={intl.formatMessage({
                      id: "dialog.edit_card.confirm_delete",
                      defaultMessage:
                        "Are you sure you want to delete this card from your collection?",
                    })}
                    extraContent={
                      placement && (
                        <Alert>
                          <Info />
                          <AlertTitle>
                            {intl.formatMessage({
                              id: "dialog.edit_card.confirm_delete.unplace_warning.title",
                              defaultMessage: "Card is Placed in Set",
                            })}
                          </AlertTitle>
                          <AlertDescription>
                            {intl.formatMessage(
                              {
                                id: "dialog.edit_card.confirm_delete.unplace_warning",
                                defaultMessage:
                                  'This card will be removed from "{setName}".',
                              },
                              { setName: placement.setName },
                            )}
                          </AlertDescription>
                        </Alert>
                      )
                    }
                    confirmLabel={intl.formatMessage({
                      id: "common.button.delete",
                      defaultMessage: "Delete",
                    })}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {intl.formatMessage({
                      id: "common.button.delete",
                      defaultMessage: "Delete",
                    })}
                  </ConfirmButton>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose} disabled={!card}>
                  {intl.formatMessage({
                    id: "common.button.cancel",
                    defaultMessage: "Cancel",
                  })}
                </Button>
                <Button type="submit" disabled={!card}>
                  {mode === "create"
                    ? intl.formatMessage({
                        id: "dialog.create_card.button.add",
                        defaultMessage: "Add Card to Collection",
                      })
                    : intl.formatMessage({
                        id: "dialog.edit_card.button.save",
                        defaultMessage: "Save Changes",
                      })}
                </Button>
              </div>
            </DialogFooter>
          )}
        </RHFForm>
      </DialogContent>
    </Dialog>
  );
}

const FormSchema = z.object({
  language: z.enum(languageEnum.enumValues).nullable(),
  variant: z.enum(variantEnum.enumValues).nullable(),
  condition: z.enum(conditionEnum.enumValues).nullable(),
  // notes: z.string().optional(),
  // photos: z.array(z.string().url()).optional(),
});
