"use client";

import type { UserCard } from "@/components/binder/types";
import { CardBrowser } from "@/components/card-browser";
import { CardFormSection } from "@/components/card-form-section";
import ConfirmButton from "@/components/confirm-button";
import {
  MultiPhotoUpload,
  useMultiPhotoUpload,
} from "@/components/image-upload";
import { InfoTooltip } from "@/components/info-tooltip";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/react";
import { useCollectionActions } from "@/lib/collection/use-collection-actions";
import { RHFForm, useRHFForm } from "@/lib/form/utils";
import { userCardFormSchema } from "@/lib/schemas/user-card";
import { Info, Trash2 } from "lucide-react";
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

  const actions = useCollectionActions();

  // Get placement status for edit mode
  const { data: placedCards } = api.userSet.getPlacedUserCardIds.useQuery(
    undefined,
    {
      enabled: mode === "edit" && !!userCard,
    },
  );

  const placement = placedCards?.find((p) => p.userCardId === userCard?.id);

  const form = useRHFForm(userCardFormSchema, {
    defaultValues:
      mode === "edit" && userCard
        ? {
            language: userCard.language ?? null,
            variant: userCard.variant ?? null,
            condition: userCard.condition ?? null,
            notes: userCard.notes ?? "",
          }
        : {
            language: null,
            variant: null,
            condition: null,
            notes: "",
          },
  });

  const photoUpload = useMultiPhotoUpload(
    mode === "edit" && userCard ? (userCard.photos ?? []) : [],
    mode === "edit" && userCard ? (userCard.coverPhoto ?? null) : null,
    mode === "edit" && userCard ? (userCard.coverCrop ?? null) : null,
  );

  async function handleSubmit(data: z.infer<typeof userCardFormSchema>) {
    if (!card) {
      return;
    }

    const { photos, coverPhotoUrl, coverCrop } =
      await photoUpload.uploadPending();

    if (mode === "create") {
      actions.card.create(
        {
          cardId: card.id,
          language: data.language ?? undefined,
          variant: data.variant ?? undefined,
          condition: data.condition ?? undefined,
          notes: data.notes || undefined,
          photos: photos.length > 0 ? photos : undefined,
          coverPhotoUrl: coverPhotoUrl ?? undefined,
          coverCrop,
        },
        card,
      );
    } else if (mode === "edit" && userCard) {
      actions.card.update({
        id: userCard.id,
        language: data.language,
        variant: data.variant,
        condition: data.condition,
        notes: data.notes || undefined,
        photos,
        coverPhotoUrl,
        coverCrop,
      });
    }

    onClose();
  }

  function handleDelete() {
    if (!userCard) return;

    onClose();
    actions.card.delete(userCard.id);
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
              <CardFormSection
                card={card}
                control={form.control}
                alert={
                  mode === "edit" && placement ? (
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
                  ) : undefined
                }
                mediaSlot={
                  <MultiPhotoUpload
                    photos={photoUpload.photos}
                    coverIndex={photoUpload.coverIndex}
                    coverCrop={photoUpload.coverCrop}
                    fileInputRef={photoUpload.fileInputRef}
                    onAddPhotos={photoUpload.handleAddPhotos}
                    onAddFiles={photoUpload.addFiles}
                    onRemovePhoto={photoUpload.handleRemovePhoto}
                    onSetCover={photoUpload.handleSetCover}
                    onSetCoverCrop={photoUpload.handleSetCoverCrop}
                    fallbackSrc={card.imageSmall}
                    fallbackAlt={card.name}
                  />
                }
              >
                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes" className="flex items-center gap-1.5">
                    {intl.formatMessage({
                      id: "form.field.notes.label",
                      defaultMessage: "Notes",
                    })}
                    <InfoTooltip
                      content={intl.formatMessage({
                        id: "form.field.notes.placeholder",
                        defaultMessage:
                          "Self-pulled\nReceived from John\nCreased corner\nScratched foil\nSwirl on the right\n…",
                      })}
                    />
                  </Label>
                  <Controller
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <Textarea
                        id="notes"
                        className="resize-none"
                        rows={5}
                        {...field}
                      />
                    )}
                  />
                </div>
              </CardFormSection>
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
