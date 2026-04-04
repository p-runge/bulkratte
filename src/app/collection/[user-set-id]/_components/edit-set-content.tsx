"use client";

import { Binder } from "@/components/binder";
import {
  BinderFormSchema,
  BinderProvider,
  useBinderContext,
} from "@/components/binder/binder-context";
import { UserSet } from "@/components/binder/types";
import { ImageUpload, useImageUpload } from "@/components/image-upload";
import { PreferredProperties } from "@/components/preferred-properties";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCollectionActions } from "@/lib/collection/use-collection-actions";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormattedMessage, useIntl } from "react-intl";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

interface EditSetContentProps {
  userSet: UserSet;
}

export function EditSetContent({ userSet }: EditSetContentProps) {
  return (
    <BinderProvider mode="edit" initialUserSet={userSet}>
      <Content userSet={userSet} />
    </BinderProvider>
  );
}

function Content({ userSet }: { userSet: UserSet }) {
  const router = useRouter();
  const intl = useIntl();

  const { form } = useBinderContext();

  const { set } = useCollectionActions();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const imageValue = form.watch("image");
  const nameValue = form.watch("name");
  const cardDataValue = form.watch("cardData");

  const {
    imagePreview,
    fileInputRef,
    handleImageUpload,
    upload: uploadImage,
    handleRemoveImage: onRemoveImage,
  } = useImageUpload(imageValue ?? null);

  async function onSubmit(data: z.infer<typeof BinderFormSchema>) {
    setIsSubmitting(true);
    try {
      const imageUrl = await uploadImage();

      const existingCardMap = new Map(
        userSet.cards.map((card) => [card.order, card.id]),
      );

      const cards = data.cardData.map((cd) => ({
        userSetCardId: existingCardMap.get(cd.order) ?? null,
        cardId: cd.cardId,
        order: cd.order,
        preferredLanguage: cd.preferredLanguage ?? null,
        preferredVariant: cd.preferredVariant ?? null,
        preferredCondition: cd.preferredCondition ?? null,
      }));

      router.push(`/collection/${userSet.set.id}`);
      set.update({
        id: userSet.set.id,
        name: data.name,
        image: imageUrl ?? undefined,
        cards,
        preferredLanguage: data.preferredLanguage,
        preferredVariant: data.preferredVariant,
        preferredCondition: data.preferredCondition,
        binderLayout: data.binderLayout,
      });
    } catch {
      setIsSubmitting(false);
      toast.error(
        intl.formatMessage({
          id: "page.set.action.save.error",
          defaultMessage: "Failed to save set.",
        }),
      );
    }
  }

  const handleRemoveImage = () => {
    onRemoveImage();
    form.setValue("image", null);
  };

  return (
    <>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mb-6">
        <div className="bg-card border rounded-lg p-4 sm:p-6 shrink-0 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="name">
                <FormattedMessage
                  id="form.field.set_name.label"
                  defaultMessage="Set Name"
                />
              </Label>
              <Input
                id="name"
                {...form.register("name")}
                placeholder={intl.formatMessage({
                  id: "form.field.set_name.placeholder",
                  defaultMessage: "Enter set name",
                })}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="lg:w-80">
              <ImageUpload
                imagePreview={imagePreview}
                fileInputRef={fileInputRef}
                onImageUpload={handleImageUpload}
                onRemoveImage={handleRemoveImage}
              />
            </div>
          </div>

          <PreferredProperties />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
            <div className="text-sm text-muted-foreground">
              {intl.formatMessage(
                {
                  id: "page.set.form.cards_selected",
                  defaultMessage: "{count} cards selected",
                },
                { count: cardDataValue.length },
              )}
            </div>
            <Button
              type="submit"
              disabled={!nameValue.trim() || isSubmitting}
              className="whitespace-nowrap w-full sm:w-auto"
            >
              <Save className="h-4 w-4 mr-2" />
              <FormattedMessage
                id="page.set.action.save"
                defaultMessage="Save Changes"
              />
            </Button>
          </div>
        </div>
      </form>

      <Binder />
    </>
  );
}
