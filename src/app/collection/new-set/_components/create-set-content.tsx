"use client";

import { ImageUpload, useImageUpload } from "@/components/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/react";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { MinimalCardData } from "../../[user-set-id]/_components/edit-set-content";
import { BinderView } from "../../[user-set-id]/_components/binder-view";


export function CreateSetContent() {
  const router = useRouter();
  const intl = useIntl();
  const [name, setName] = useState("");
  const [cards, setCards] = useState<Array<{ userSetCardId: string | null; cardId: string | null }>>([]);
  const [cardDataMap, setCardDataMap] = useState<Map<string, MinimalCardData>>(new Map());
  const [cardIdsToFetch, setCardIdsToFetch] = useState<string[]>([]);
  const {
    fileInputRef,
    imagePreview,
    image,
    handleImageUpload,
    handleRemoveImage,
  } = useImageUpload();

  const { mutateAsync: createUserSet, isPending } = api.userSet.create.useMutation();
  const { data: fetchedCards } = api.card.getByIds.useQuery(
    { cardIds: cardIdsToFetch },
    { enabled: cardIdsToFetch.length > 0 }
  );

  // When new cards are fetched, add them to cardDataMap
  useEffect(() => {
    if (!fetchedCards || fetchedCards.length === 0) return;

    setCardDataMap((prevMap) => {
      const newMap = new Map(prevMap);
      fetchedCards.forEach((card) => {
        newMap.set(card.id, {
          id: card.id,
          name: card.name,
          imageSmall: card.imageSmall,
        });
      });
      return newMap;
    });

    // Clear fetch queue
    setCardIdsToFetch([]);
  }, [fetchedCards]);

  const handleCardsChange = (newCards: Array<{ userSetCardId: string | null; cardId: string | null }>) => {
    // Find card IDs that we don't have in our map yet
    const missingCardIds = newCards
      .map((slot) => slot.cardId)
      .filter((id): id is string => id !== null && !cardDataMap.has(id));

    setCards(newCards);

    // Trigger fetching of missing cards
    if (missingCardIds.length > 0) {
      setCardIdsToFetch(missingCardIds);
    }
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

      <BinderView
        mode="edit"
        cards={cards}
        cardDataMap={cardDataMap}
        onCardsChange={handleCardsChange}
      />
    </div>
  );
}
