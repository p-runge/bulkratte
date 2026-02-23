"use client";

import { Binder } from "@/components/binder";
import {
  BinderFormSchema,
  BinderProvider,
  useBinderContext,
} from "@/components/binder/binder-context";
import { ImageUpload, useImageUpload } from "@/components/image-upload";
import { PreferredProperties } from "@/components/preferred-properties";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/react";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormattedMessage, useIntl } from "react-intl";
import { useEffect } from "react";
import { toast } from "sonner";
import z from "zod";

export default function NewSetPage() {
  return (
    <BinderProvider
      mode="create"
      initialUserSet={{
        set: {
          // TODO: make id and createdAt not required here
          id: "",
          createdAt: new Date().toISOString(),
          name: "",
          image: null,
          preferredLanguage: null,
          preferredVariant: null,
          preferredCondition: null,
        },
        cards: [],
      }}
    >
      <Content />
    </BinderProvider>
  );
}

function Content() {
  const router = useRouter();
  const intl = useIntl();

  const { form } = useBinderContext();

  useEffect(() => {
    toast.info(
      intl.formatMessage({
        id: "page.set.new.hint",
        defaultMessage:
          "First, set up your set's structure — this defines how it will look once finished. After creating it, you can place cards from your collection into it.",
      }),
      {
        duration: Infinity,
        closeButton: true,
        position: "top-center",
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { mutateAsync: createUserSet, isPending } =
    api.userSet.create.useMutation();

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
    await createUserSet({
      name: data.name,
      image: data.image ?? undefined,
      cardData: data.cardData.map((cd) => ({
        cardId: cd.cardId,
        order: cd.order,
        preferredLanguage: cd.preferredLanguage ?? null,
        preferredVariant: cd.preferredVariant ?? null,
        preferredCondition: cd.preferredCondition ?? null,
      })),
      preferredLanguage: data.preferredLanguage,
      preferredVariant: data.preferredVariant,
      preferredCondition: data.preferredCondition,
    });
    router.push("/collection");
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
      <div className="flex items-center gap-4 mb-6">
        <Link href="/collection">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">
            {intl.formatMessage({
              id: "page.set.new.title",
              defaultMessage: "Create New Set",
            })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {intl.formatMessage({
              id: "page.set.description",
              defaultMessage:
                "Define what cards you would like this set to contain once it is finished.",
            })}
          </p>
        </div>
      </div>

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
                id="page.set.action.create"
                defaultMessage="Create Set"
              />
            </Button>
          </div>
        </div>
      </form>

      <Binder />
    </>
  );
}
