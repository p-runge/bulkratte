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
import { api } from "@/lib/api/react";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormattedMessage, useIntl } from "react-intl";
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

  const apiUtils = api.useUtils();
  const { mutateAsync: updateUserSet, isPending } =
    api.userSet.update.useMutation();

  const imageValue = form.watch("image");
  const nameValue = form.watch("name");
  const cardDataValue = form.watch("cardData");

  const {
    imagePreview,
    fileInputRef,
    handleImageUpload: onImageChange,
    handleRemoveImage: onRemoveImage,
  } = useImageUpload(imageValue ?? null);

  async function onSubmit(data: z.infer<typeof BinderFormSchema>) {
    // Transform cardData to the format expected by the update API
    // We need to match cardData positions to existing userSetCard IDs
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

    await updateUserSet({
      id: userSet.set.id,
      name: data.name,
      image: data.image ?? undefined,
      cards,
      preferredLanguage: data.preferredLanguage,
      preferredVariant: data.preferredVariant,
      preferredCondition: data.preferredCondition,
    });

    // Invalidate the queries to ensure fresh data
    await apiUtils.userSet.getById.invalidate({ id: userSet.set.id });
    await apiUtils.userSet.getList.invalidate();

    router.push(`/collection/${userSet.set.id}`);
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    onImageChange(e);
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue("image", reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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
              disabled={!nameValue.trim() || isPending}
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
