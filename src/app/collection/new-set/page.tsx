"use client";

import { CardBrowser } from "@/components/card-browser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/react";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useIntl } from "react-intl";

export default function NewSetPage() {
  const router = useRouter();
  const intl = useIntl();
  const [setName, setSetName] = useState("");
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  const handleCardToggle = (cardId: string) => {
    setSelectedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const { mutate: createUserSet } = api.userSet.create.useMutation({
    onSuccess() {
      router.push("/collection");
    },
    onError(error) {
      console.error("Error creating user set:", error);
    },
  });

  const handleCreateSet = async () => {
    if (!setName.trim()) {
      console.error("Please enter a set name");
      return;
    }

    if (selectedCards.size === 0) {
      console.error("Please select at least one card");
      return;
    }

    setIsCreating(true);

    createUserSet(
      {
        name: setName,
        cardIds: selectedCards,
      },
      {
        onSettled() {
          setIsCreating(false);
        },
      }
    );
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
              id: "userSet.title.new",
              defaultMessage: "Create New Set",
            })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {intl.formatMessage({
              id: "userSet.subtitle",
              defaultMessage: "Name your set and select cards to add",
            })}
          </p>
        </div>
      </div>

      <Card className="p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="set-name">
              {intl.formatMessage({
                id: "userSet.nameLabel",
                defaultMessage: "Set Name",
              })}
            </Label>
            <Input
              id="set-name"
              placeholder={intl.formatMessage({
                id: "userSet.namePlaceholder",
                defaultMessage: "My Awesome Set",
              })}
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              className="text-lg"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {intl.formatMessage({
                id: "userSet.cardsSelected",
                defaultMessage: "{count} cards selected",
              },
                { count: selectedCards.size })}
            </div>
            <Button
              onClick={handleCreateSet}
              disabled={
                isCreating || !setName.trim() || selectedCards.size === 0
              }
              size="lg"
            >
              <Plus className="h-5 w-5 mr-2" />
              {isCreating
                ? intl.formatMessage({
                  id: "userSet.creating",
                  defaultMessage: "Creating...",
                })
                : intl.formatMessage({
                  id: "userSet.createButton",
                  defaultMessage: "Create Set",
                })}
            </Button>
          </div>
        </div>
      </Card>

      <hr className="mb-6" />

      <CardBrowser
        selectedCards={selectedCards}
        onCardToggle={handleCardToggle}
      />
    </>
  );
}
