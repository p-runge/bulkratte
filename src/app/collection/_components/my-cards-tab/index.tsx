"use client"

import { UserCardBrowser } from "@/components/card-browser/user-card-browser";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/api/react";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useIntl } from "react-intl";
import CreateUserCardDialog from "./create-user-card-dialog";
import Loader from "@/components/loader";

export default function MyCardsTab() {
  const intl = useIntl();

  const [isCreateCardDialogOpen, setIsCreateCardDialogOpen] = useState(false);

  const { data, isLoading } = api.userCard.getList.useQuery();
  const userCards = data ?? [];

  if (isLoading) {
    return <div className="flex justify-center">
      <Loader />
    </div>;
  }

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
        {userCards.length === 0 ? (
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
          <UserCardBrowser
            onCardClick={(cardId) => {
              console.log(cardId);
            }}
          />
        )}
      </TabsContent>

      {isCreateCardDialogOpen && <CreateUserCardDialog
        onClose={() => setIsCreateCardDialogOpen(false)}
      />}
    </>
  );
}
