"use client";

import { ImageUpload, useImageUpload } from "@/components/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/react";
import { AppRouter } from "@/lib/api/routers/_app";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { EditableBinderView } from "./editable-binder-view";

export type MinimalCardData = {
  id: string;
  name: string;
  imageSmall: string;
};

type UserSet = Awaited<ReturnType<AppRouter["userSet"]["getById"]>>;

interface EditSetContentProps {
  userSet: UserSet;
}

export function EditSetContent({ userSet }: EditSetContentProps) {
  const router = useRouter();
  const intl = useIntl();
  const [name, setName] = useState(userSet.set.name);
  const {
    fileInputRef,
    imagePreview,
    image,
    handleImageUpload,
    handleRemoveImage,
  } = useImageUpload(userSet.set.image);

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

  // Build initial cardDataMap from existing cards
  const initialCardDataMap = new Map<string, MinimalCardData>();
  userSet.cards.forEach((userCard) => {
    if (userCard.card) {
      initialCardDataMap.set(userCard.cardId, {
        id: userCard.card.id,
        name: userCard.card.name,
        imageSmall: userCard.card.imageSmall,
      });
    }
  });

  const [cardDataMap, setCardDataMap] = useState<Map<string, MinimalCardData>>(initialCardDataMap);
  const [cardIdsToFetch, setCardIdsToFetch] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const apiUtils = api.useUtils();
  const { mutateAsync: updateUserSet, isPending } = api.userSet.update.useMutation();
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

    setIsDirty(true);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setIsDirty(true);
  };

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
        <div className="mb-6">
          <ImageUpload
            imagePreview={imagePreview}
            fileInputRef={fileInputRef}
            onImageUpload={async (e) => {
              await handleImageUpload(e);
              setIsDirty(true);
            }}
            onRemoveImage={() => {
              handleRemoveImage();
              setIsDirty(true);
            }}
          />
        </div>

        <div className="flex items-end gap-4">\n          <div className="flex-1 space-y-2">\n            <Label htmlFor="name">\n              <FormattedMessage id="form.field.set_name.label" defaultMessage="Set Name" />\n            </Label>
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
          <Button onClick={handleSave} disabled={!isDirty || isPending} size="lg">
            <Save className="h-5 w-5 mr-2" />
            <FormattedMessage id="page.set.action.save" defaultMessage="Save Changes" />
          </Button>
        </div>
      </div>

      <EditableBinderView
        cards={cards}
        cardDataMap={cardDataMap}
        onCardsChange={handleCardsChange}
      />
    </div>
  );
}
