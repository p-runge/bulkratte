import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api/server";
import { getIntl } from "@/lib/i18n/server";
import { BookHeart, Library, Plus } from "lucide-react";
import Link from "next/link";
import MyCardsTab from "./_components/my-card-tab";

export default async function CollectionPage() {
  const intl = await getIntl();

  return (
    <>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {intl.formatMessage({
              id: "collection.title",
              defaultMessage: "My Collection",
            })}
          </h1>
          <p className="text-muted-foreground">
            {intl.formatMessage({
              id: "collection.description",
              defaultMessage: "Track and manage your Pokémon card collection",
            })}
          </p>
        </div>
      </div>
      <Tabs defaultValue="collections" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="collections">
            <span className="inline-flex items-center gap-2">
              <BookHeart className="w-4 h-4" />
              {intl.formatMessage({
                id: "collection.tabs.sets",
                defaultMessage: "My Sets",
              })}
            </span>
          </TabsTrigger>
          <TabsTrigger value="my-cards">
            <span className="inline-flex items-center gap-2">
              <Library className="w-4 h-4" />
              {intl.formatMessage({
                id: "collection.tabs.cards",
                defaultMessage: "My Cards",
              })}
            </span>
          </TabsTrigger>
        </TabsList>
        <MySetsTab />
        <MyCardsTab />
      </Tabs>
    </>
  );
}

async function MySetsTab() {
  const intl = await getIntl();
  const userSets = await api.userSet.getList();

  return (
    <TabsContent value="collections">
      <div className="mb-6 flex justify-end">
        <Link href="/collection/new-set">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            {intl.formatMessage({
              id: "collection.actions.addNewSet",
              defaultMessage: "Add New Set",
            })}
          </Button>
        </Link>
      </div>
      {true || userSets.length === 0 ? (
        // No sets
        <Card className="text-center py-12">
          <CardContent>
            <h3 className="text-lg font-semibold mb-2">
              {intl.formatMessage({
                id: "collection.sets.noneTitle",
                defaultMessage: "No sets added yet",
              })}
            </h3>
            <p className="mb-6 text-muted-foreground">
              {intl.formatMessage({
                id: "collection.sets.noneDescription",
                defaultMessage: "Add your first set!",
              })}
            </p>
            <Link href="/collection/new-set">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                {intl.formatMessage({
                  id: "collection.actions.addFirstSet",
                  defaultMessage: "Add Your First Set",
                })}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        // List sets in a grid
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {userSets.map((userSet) => (
            <Link
              key={userSet.id}
              href={`/collection/${userSet.id}`}
              className="block"
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{userSet.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    {intl.formatMessage({
                      id: "collection.sets.cardDescription",
                      defaultMessage: "View and manage cards in this set.",
                    })}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </TabsContent>
  );
}
