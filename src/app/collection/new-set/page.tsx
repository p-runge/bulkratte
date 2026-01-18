"use client";

import { Binder } from "@/components/binder";
import { BinderCardData } from "@/components/binder/types";
import { ImageUpload, useImageUpload } from "@/components/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormattedMessage, useIntl } from "react-intl";
import z from "zod";

const FormSchema = z.object({
  name: z.string().min(1, "Set name is required"),
  image: z.string().optional(),
  cardData: z.array(
    z.object({
      cardId: z.string(),
      order: z.number(),
    }),
  ),
});

export default function NewSetPage() {
  const router = useRouter();
  const intl = useIntl();

  const { mutateAsync: createUserSet, isPending } =
    api.userSet.create.useMutation();

  const [cardData, setCardData] = useState<Map<number, BinderCardData>>(
    new Map(),
  );

  const form = useForm({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
      image: undefined,
      cardData: [],
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = form;
  const imageValue = watch("image");
  const nameValue = watch("name");
  const cardDataValue = watch("cardData");

  const {
    imagePreview,
    fileInputRef,
    handleImageUpload: onImageChange,
    handleRemoveImage: onRemoveImage,
  } = useImageUpload(imageValue ?? null);

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    await createUserSet({
      name: data.name,
      image: data.image,
      cardData: data.cardData,
    });
    router.push("/collection");
  }

  const handleCardsChange = (newCardData: Map<number, BinderCardData>) => {
    setCardData(newCardData);

    // Convert Map to array format for form
    const cardDataArray = Array.from(newCardData.entries())
      .filter(([_, card]) => card.card !== null)
      .map(([order, card]) => ({
        cardId: card.card.id,
        order,
      }));

    setValue("cardData", cardDataArray);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    onImageChange(e);
    // Extract the uploaded image URL from the event and set it in the form
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setValue("image", reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    onRemoveImage();
    setValue("image", undefined);
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
              id: "page.set.new.description",
              defaultMessage: "Name your set and select cards to add",
            })}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="bg-card border rounded-lg p-6">
            {/* Image Upload Section */}
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
                  {...register("name")}
                  placeholder={intl.formatMessage({
                    id: "form.field.set_name.placeholder",
                    defaultMessage: "Enter set name",
                  })}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">
                    {errors.name.message}
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
                  id="page.set.action.create"
                  defaultMessage="Create Set"
                />
              </Button>
            </div>
          </div>
        </form>

        <Binder cardData={Array.from(cardData.values())} />
      </div>
    </>
  );
}
