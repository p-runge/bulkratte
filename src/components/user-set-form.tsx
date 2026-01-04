"use client";

import { CardBrowser } from "@/components/card-browser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api/react";
import { AppRouter } from "@/lib/api/routers/_app";
import { FormField, RHFForm, useRHFForm } from "@/lib/form/utils";
import { Plus, Save, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Controller } from "react-hook-form";
import { FormattedMessage, useIntl } from "react-intl";
import z from "zod";

type UserSet = Awaited<ReturnType<AppRouter["userSet"]["getById"]>>

type Props = {
  mode: "create" | "edit";
  userSet?: UserSet;
}

export default function UserSetForm({ mode, userSet }: Props) {
  const router = useRouter();
  const intl = useIntl();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(userSet?.set.image ?? null);

  const apiUtils = api.useUtils();
  const { mutateAsync: updateUserSet } = api.userSet.update.useMutation();
  const { mutateAsync: createUserSet } = api.userSet.create.useMutation();

  const FormSchema = useFormSchema();
  const form = useRHFForm(FormSchema, {
    defaultValues: {
      name: userSet?.set.name ?? "",
      cardIds: userSet?.cards.map((card) => card.cardId) ?? [],
      image: userSet?.set.image ?? "",
    }
  });

  const handleCardToggle = (cardId: string) => {
    const currentCardIds = form.getValues("cardIds");
    const cardSet = new Set(currentCardIds);

    if (cardSet.has(cardId)) {
      cardSet.delete(cardId);
    } else {
      cardSet.add(cardId);
    }

    form.setValue("cardIds", Array.from(cardSet), { shouldDirty: true });
  };

  function scaleImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // Scale down if either dimension is larger than 100px
          const maxDimension = 100;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          // Convert to base64
          const base64 = canvas.toDataURL(file.type);
          resolve(base64);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64Image = await scaleImage(file);
      form.setValue("image", base64Image, { shouldDirty: true });
      setImagePreview(base64Image);
    } catch (error) {
      console.error("Error processing image:", error);
    }
  };

  function handleRemoveImage() {
    form.setValue("image", "", { shouldDirty: true });
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    if (mode === "create") {
      await createUserSet(
        {
          name: data.name,
          cardIds: new Set(data.cardIds),
          image: data.image || undefined,
        },
        {
          onSuccess() {
            router.push("/collection");
          },
          onError(error) {
            console.error("Error creating user set:", error);
          },
        }
      );
    } else {
      await updateUserSet(
        {
          id: userSet!.set.id,
          name: data.name,
          cardIds: new Set(data.cardIds),
          image: data.image || undefined,
        },
        {
          async onSuccess() {
            await apiUtils.userSet.getById.invalidate({ id: userSet!.set.id });
            router.push("/collection");
          },
          onError(error) {
            console.error("Error updating user set:", error);
          },
        }
      );
    }
  };

  return (
    <>
      <Card className="p-6 mb-6">
        <div>
          <RHFForm form={form} onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
              <div className="flex-1 space-y-2">
                <FormField name="name" label="Name" />
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  {intl.formatMessage(
                    {
                      id: "userSet.cardsSelected",
                      defaultMessage: "{count} cards selected",
                    },
                    { count: form.getValues("cardIds").length }
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={
                    form.formState.isSubmitting || (mode === "edit" && !form.formState.isDirty)
                  }
                  size="lg"
                >
                  {mode === "create" ? (
                    <>
                      <Plus className="h-5 w-5 mr-2" />
                      <FormattedMessage
                        id="userSet.createButton"
                        defaultMessage="Create Set"
                      />
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5 mr-2" />
                      <FormattedMessage
                        id="userSet.save"
                        defaultMessage="Save Changes"
                      />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Image Upload Section */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {intl.formatMessage({
                  id: "userSet.imageLabel",
                  defaultMessage: "Set Image (optional)",
                })}
              </label>
              <div className="flex items-center gap-4">
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Set preview"
                      className="w-24 h-24 object-contain rounded border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={handleRemoveImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="w-24 h-24 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground">
                    <Upload className="h-8 w-8" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload">
                    <Button type="button" variant="outline" asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        {intl.formatMessage({
                          id: "userSet.uploadImage",
                          defaultMessage: "Upload Image",
                        })}
                      </span>
                    </Button>
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {intl.formatMessage({
                      id: "userSet.imageDescription",
                      defaultMessage: "Images will be automatically scaled to max 100px",
                    })}
                  </p>
                </div>
              </div>
            </div>
          </RHFForm>
        </div>
      </Card>

      <hr className="mb-6" />

      <Controller name="cardIds" control={form.control} render={({ field, fieldState }) => (
        <>
          <p className="text-sm text-destructive">{fieldState.error?.message ?? "\u00A0"}</p>
          <CardBrowser
            selectionMode="multi"
            selectedCards={new Set(field.value)}
            onCardClick={(cardId: string) => {
              handleCardToggle(cardId);
            }}
          />
        </>
      )}>
      </Controller>
    </>
  );
}

function useFormSchema() {
  const intl = useIntl();

  return useMemo(() => z.object({
    name: z.string().min(1, intl.formatMessage({
      id: "form.validation.required",
      defaultMessage: "This field is required.",
    })),
    cardIds: z.array(z.string()).min(1, intl.formatMessage({
      id: "userSetForm.validation.atLeastOneCard",
      defaultMessage: "At least one card must be selected.",
    })),
    image: z.string().optional(),
  }), [intl]);
}
