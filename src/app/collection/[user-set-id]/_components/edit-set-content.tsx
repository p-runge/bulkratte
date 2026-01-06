"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/react";
import { AppRouter } from "@/lib/api/routers/_app";
import { Save, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { EditableBinderView } from "./editable-binder-view";

type UserSet = Awaited<ReturnType<AppRouter["userSet"]["getById"]>>;

interface EditSetContentProps {
  userSet: UserSet;
}

export function EditSetContent({ userSet }: EditSetContentProps) {
  const router = useRouter();
  const intl = useIntl();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(userSet.set.name);
  const [imagePreview, setImagePreview] = useState<string | null>(userSet.set.image ?? null);
  const [image, setImage] = useState<string | undefined>(userSet.set.image || undefined);

  // Build initial cards array with userSetCardIds and cardIds
  const initialCards = (() => {
    const maxOrder = Math.max(...userSet.cards.map((c) => c.order ?? 0), 0);
    const orderedCards: Array<{ userSetCardId: string | null; cardId: string | null }> = Array(maxOrder + 1)
      .fill(null)
      .map(() => ({ userSetCardId: null, cardId: null }));

    userSet.cards.forEach((card) => {
      if (card.order !== null && card.order !== undefined) {
        orderedCards[card.order] = {
          userSetCardId: card.id,
          cardId: card.cardId,
        };
      }
    });

    return orderedCards;
  })();

  const [cards, setCards] = useState<Array<{ userSetCardId: string | null; cardId: string | null }>>(initialCards);
  const [isDirty, setIsDirty] = useState(false);

  const apiUtils = api.useUtils();
  const { mutateAsync: updateUserSet, isPending } = api.userSet.update.useMutation();

  const handleCardsChange = (newCards: Array<{ userSetCardId: string | null; cardId: string | null }>) => {
    setCards(newCards);
    setIsDirty(true);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setIsDirty(true);
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
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64Image = await scaleImage(file);
      setImage(base64Image);
      setImagePreview(base64Image);
      setIsDirty(true);
    } catch (error) {
      console.error("Error processing image:", error);
    }
  }

  function handleRemoveImage() {
    setImage(undefined);
    setImagePreview(null);
    setIsDirty(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const handleSave = async () => {
    try {
      await updateUserSet({
        id: userSet.set.id,
        name,
        cards,
        image,
      });

      await apiUtils.userSet.getById.invalidate({ id: userSet.set.id });
      setIsDirty(false);
      router.push(`/collection/${userSet.set.id}`);
    } catch (error) {
      console.error("Error updating user set:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-lg p-6">
        {/* Image Upload Section */}
        <div className="mb-6 space-y-2">
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

        <div className="flex items-end gap-4">
          <div className="flex-1 space-y-2">
            <Label htmlFor="name">
              <FormattedMessage id="userSet.name" defaultMessage="Set Name" />
            </Label>
            <Input
              id="name"
              value={name}
              onChange={handleNameChange}
              placeholder={intl.formatMessage({
                id: "userSet.namePlaceholder",
                defaultMessage: "Enter set name",
              })}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {intl.formatMessage(
              {
                id: "userSet.cardsSelected",
                defaultMessage: "{count} cards selected",
              },
              { count: cards.filter(c => c.cardId !== null).length }
            )}
          </div>
          <Button onClick={handleSave} disabled={!isDirty || isPending} size="lg">
            <Save className="h-5 w-5 mr-2" />
            <FormattedMessage id="userSet.save" defaultMessage="Save Changes" />
          </Button>
        </div>
      </div>

      <EditableBinderView
        userSet={userSet}
        cards={cards}
        onCardsChange={handleCardsChange}
      />
    </div>
  );
}
