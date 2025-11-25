"use client"

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useIntl } from "react-intl";
import CreateCardDialog from "./create-card-dialog";

export default function MyCardsTab() {
  const intl = useIntl();

  const [isCreateCardDialogOpen, setIsCreateCardDialogOpen] = useState(false);

  const groupedCards: {
    id: number;
    card_id: number;
    card_name: string;
    card_number: string;
    rarity: string | null;
    set_name: string;
    language_name: string;
    variant_name: string;
    condition_name: string;
    condition_abbr: string;
    quantity: number;
    notes: string | null;
  }[][] = [];

  return (
    <>
      <TabsContent value="my-cards">
        <div className="mb-6 flex justify-end">
          <Button onClick={() => setIsCreateCardDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {intl.formatMessage({
              id: "collection.actions.addNewCard",
              defaultMessage: "Add New Card",
            })}
          </Button>
        </div>
        {Object.keys(groupedCards).length === 0 ? (
          // No cards in collection
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-lg font-semibold mb-2">
                {intl.formatMessage({
                  id: "collection.cards.noneTitle",
                  defaultMessage: "No cards in your collection yet",
                })}
              </h3>
              <p className="text-muted-foreground mb-6">
                {intl.formatMessage({
                  id: "collection.cards.noneDescription",
                  defaultMessage:
                    "Start adding cards to your collection!",
                })}
              </p>
              <Button onClick={() => setIsCreateCardDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {intl.formatMessage({
                  id: "collection.actions.addFirstCard",
                  defaultMessage: "Add Your First Card",
                })}
              </Button>
            </CardContent>
          </Card>
        ) : (
          // List cards in a grid
          <div className="space-y-8">
            {Object.entries(groupedCards).map(([setName, cards]) => (
              <Card key={setName}>
                <CardHeader>
                  <CardTitle>{setName}</CardTitle>
                  <CardDescription>
                    {intl.formatMessage(
                      {
                        id: "collection.cards.owned",
                        defaultMessage: "{count} cards owned",
                      },
                      { count: cards.length }
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {cards.map((card) => (
                      <div
                        key={card.id}
                        className="flex items-center justify-between p-4 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="font-medium">
                              #{card.card_number} {card.card_name}
                            </div>
                            {card.rarity && (
                              <Badge variant="outline" className="text-xs">
                                {card.rarity}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {card.language_name} • {card.variant_name} •{" "}
                            {card.condition_name}
                            {card.quantity > 1 && (
                              <>
                                {" "}
                                •{" "}
                                {intl.formatMessage({
                                  id: "collection.card.qty",
                                  defaultMessage: "Qty",
                                })}
                                : {card.quantity}
                              </>
                            )}
                          </div>
                          {card.notes && (
                            <div className="text-sm text-muted-foreground mt-1 italic">
                              {card.notes}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={
                              card.condition_abbr === "M"
                                ? "default"
                                : card.condition_abbr === "NM"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {card.condition_abbr}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      {isCreateCardDialogOpen && <CreateCardDialog
        onClose={() => setIsCreateCardDialogOpen(false)}
      />}
    </>
  );
}
