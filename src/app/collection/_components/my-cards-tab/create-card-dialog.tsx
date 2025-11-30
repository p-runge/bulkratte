import { CardBrowser } from "@/components/card-browser";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api/react";
import Image from "next/image";
import { useState } from "react";
import { useIntl } from "react-intl";

export default function CreateCardDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const intl = useIntl();

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const { data: card } = api.card.getById.useQuery(
    { cardId: selectedCardId! },
    {
      enabled: !!selectedCardId,
    }
  );
  const { mutateAsync: addCardToCollection } = api.userCard.create.useMutation();
  const apiUtils = api.useUtils();

  async function handleAddCard() {
    if (card) {
      await addCardToCollection({
        cardId: card.id,
        // TODO: link form values as soon as implemented
        condition: "Near Mint",
        language: "en",
        variant: "Unlimited",
        notes: undefined,
        photos: undefined,
      });
      await apiUtils.userCard.getList.invalidate();
    }
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose} modal>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {intl.formatMessage({
              id: "collection.cards.create.title",
              defaultMessage: "Add New Card",
            })}
          </DialogTitle>
        </DialogHeader>
        {/* TODO: add default settings here (language, condition, variant, etc.) */}
        <div className="py-4">
          {!selectedCardId ? <CardBrowser selectionMode="single" onCardClick={(cardId) => setSelectedCardId(cardId)} maxHeightGrid="400px" /> :
            card ? (
              <div className="flex gap-6">
                <Image
                  src={card.imageSmall}
                  alt={card.name}
                  width={240}
                  height={165}
                  unoptimized
                  className="w-auto h-auto object-contain rounded-md"
                  draggable={false}
                  priority
                />
                <div>
                  <h2 className="text-2xl font-bold mb-2">
                    {card.name}
                  </h2>
                  {/* TODO: Additional form fields for language, condition, variant, etc. would go here respecting default settings */}
                </div>
              </div>
            ) : (
              // loading skeleton
              <div className="w-60 h-84 bg-muted animate-pulse rounded-md" />
            )}
        </div>
        {selectedCardId && <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={!card}>
            {intl.formatMessage({
              id: "collection.cards.create.cancelButton",
              defaultMessage: "Cancel",
            })}
          </Button>
          <Button onClick={handleAddCard} disabled={!card}>
            {intl.formatMessage({
              id: "collection.cards.create.addButton",
              defaultMessage: "Add Card to Collection",
            })}
          </Button>
        </DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
