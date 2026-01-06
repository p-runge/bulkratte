"use client";

import { Button } from "@/components/ui/button";
import { ImageUpload, useImageUpload } from "@/components/image-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/react";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { EditableBinderView } from "../../[user-set-id]/_components/editable-binder-view";

export function CreateSetContent() {
  const router = useRouter();
  const intl = useIntl();
  const [name, setName] = useState("");
  const [cards, setCards] = useState<Array<{ userSetCardId: string | null; cardId: string | null }>>([]);
  const {
    fileInputRef,
    imagePreview,
    image,
    handleImageUpload,
    handleRemoveImage,
  } = useImageUpload();

  const { mutateAsync: createUserSet, isPending } = api.userSet.create.useMutation();

  // Fetch all cards to have the data available
  const { data: allCardsData } = api.card.getList.useQuery({});

  const handleCardsChange = (newCards: Array<{ userSetCardId: string | null; cardId: string | null }>) => {
    setCards(newCards);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      return;
    }

    try {
      const userSetId = await createUserSet({
        name,
        cards,
        image,
      });

      router.push(`/collection/${userSetId}`);
    } catch (error) {
      console.error("Error creating user set:", error);
    }
  };

  // Build userSet object with the selected cards
  const userSet = useMemo(() => {
    const selectedCardData = cards
      .map((card, index) => {
        if (!card.cardId) return null;
        const cardData = allCardsData?.find((c) => c.id === card.cardId);
        if (!cardData) return null;
        return {
          id: `temp-${index}`,
          cardId: card.cardId,
          userCardId: null,
          order: index,
          card: cardData,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      set: { id: "", name: "", image: null },
      cards: selectedCardData,
    };
  }, [cards, allCardsData]);

  return (
    <div className="space-y-6">
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
              <FormattedMessage id="form.field.set_name.label" defaultMessage="Set Name" />
            </Label>
            <Input
              id="name"
              value={name}
              onChange={handleNameChange}
              placeholder={intl.formatMessage({
                id: "form.field.set_name.placeholder",
                defaultMessage: "Enter set name",
              })}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {intl.formatMessage(
              {
                id: "page.set.form.cards_selected",
                defaultMessage: "{count} cards selected",
              },
              { count: cards.filter(c => c.cardId !== null).length }
            )}
          </div>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || isPending}
            size="lg"
          >
            <Save className="h-5 w-5 mr-2" />
            <FormattedMessage id="page.set.action.create" defaultMessage="Create Set" />
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
