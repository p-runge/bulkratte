"use client";

import { Binder } from "@/components/binder";
import {
  BinderFormSchema,
  BinderProvider,
  useBinderContext,
} from "@/components/binder/binder-context";
import { UserSet } from "@/components/binder/types";
import { ImageUpload, useImageUpload } from "@/components/image-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/react";
import { variantEnum } from "@/lib/db/enums";
import pokemonAPI from "@/lib/pokemon-api";
import { ChevronDown, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller } from "react-hook-form";
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

    // Invalidate the query to ensure fresh data
    await apiUtils.userSet.getById.invalidate({ id: userSet.set.id });

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
        <div className="bg-card border rounded-lg p-6 shrink-0">
          <div className="mb-6">
            <ImageUpload
              imagePreview={imagePreview}
              fileInputRef={fileInputRef}
              onImageUpload={handleImageUpload}
              onRemoveImage={handleRemoveImage}
            />
          </div>

          <div className="flex items-end gap-4">
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
              size="lg"
            >
              <Save className="h-5 w-5 mr-2" />
              <FormattedMessage
                id="page.set.action.save"
                defaultMessage="Save Changes"
              />
            </Button>
          </div>

          <div className="mt-6">
            <PreferredProperties />
          </div>
        </div>
      </form>

      <Binder />
    </>
  );
}

function PreferredProperties() {
  const [isOpen, setIsOpen] = useState(false);
  const { form } = useBinderContext();

  const preferredLanguage = form.watch("preferredLanguage");
  const preferredVariant = form.watch("preferredVariant");
  const preferredCondition = form.watch("preferredCondition");

  const hasAnyPreferred =
    preferredLanguage || preferredVariant || preferredCondition;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:underline">
        <span>Preferred Card Properties</span>
        {hasAnyPreferred && (
          <Badge variant="outline" className="ml-1">
            {
              [preferredLanguage, preferredVariant, preferredCondition].filter(
                Boolean,
              ).length
            }
          </Badge>
        )}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 space-y-4">
        {/* Language Selector */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Preferred Language</Label>
          <p className="text-xs text-muted-foreground">
            Select a preferred language for cards in this set
          </p>
          <Controller
            control={form.control}
            name="preferredLanguage"
            render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={field.value === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => field.onChange(null)}
                >
                  None
                </Button>
                {pokemonAPI.cardLanguages.map((lang) => (
                  <Button
                    key={lang.code}
                    type="button"
                    variant={field.value === lang.code ? "default" : "outline"}
                    size="sm"
                    onClick={() => field.onChange(lang.code)}
                    className="flex items-center gap-2"
                  >
                    <span className="text-base">{lang.flag}</span>
                    <span>{lang.name}</span>
                  </Button>
                ))}
              </div>
            )}
          />
        </div>

        {/* Variant Selector */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Preferred Variant</Label>
          <p className="text-xs text-muted-foreground">
            Select a preferred variant for cards in this set
          </p>
          <Controller
            control={form.control}
            name="preferredVariant"
            render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={field.value === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => field.onChange(null)}
                >
                  None
                </Button>
                {variantEnum.enumValues.map((variant) => (
                  <Button
                    key={variant}
                    type="button"
                    variant={field.value === variant ? "default" : "outline"}
                    size="sm"
                    onClick={() => field.onChange(variant)}
                  >
                    {variant}
                  </Button>
                ))}
              </div>
            )}
          />
        </div>

        {/* Condition Selector */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Preferred Condition</Label>
          <p className="text-xs text-muted-foreground">
            Select a preferred condition for cards in this set
          </p>
          <Controller
            control={form.control}
            name="preferredCondition"
            render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={field.value === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => field.onChange(null)}
                >
                  None
                </Button>
                {pokemonAPI.conditions.map((condition) => (
                  <Button
                    key={condition.value}
                    type="button"
                    variant={
                      field.value === condition.value ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => field.onChange(condition.value)}
                    className="flex items-center gap-2"
                  >
                    <Badge
                      className={`${condition.color} border text-xs pointer-events-none`}
                    >
                      {condition.short}
                    </Badge>
                    <span>{condition.value}</span>
                  </Button>
                ))}
              </div>
            )}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
