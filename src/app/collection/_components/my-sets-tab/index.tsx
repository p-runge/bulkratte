"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/api/react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useIntl } from "react-intl";
import Loader from "@/components/loader";

export default function MySetsTab() {
  const intl = useIntl();

  const { data, isLoading } = api.userSet.getList.useQuery();
  const userSets = data ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <TabsContent value="collections">
      <div className="mb-6 flex justify-end">
        <Link href="/collection/new-set">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            {intl.formatMessage({
              id: "page.collection.action.add_set",
              defaultMessage: "Add New Set",
            })}
          </Button>
        </Link>
      </div>
      {userSets.length === 0 ? (
        // No sets
        <Card className="text-center py-12">
          <CardContent>
            <h3 className="text-lg font-semibold mb-2">
              {intl.formatMessage({
                id: "page.collection.sets.empty.title",
                defaultMessage: "No sets added yet",
              })}
            </h3>
            <p className="mb-6 text-muted-foreground">
              {intl.formatMessage({
                id: "page.collection.sets.empty.description",
                defaultMessage: "Add your first set!",
              })}
            </p>
            <Link href="/collection/new-set">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                {intl.formatMessage({
                  id: "page.collection.action.add_first_set",
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
                <CardContent>
                  <div className="flex gap-4">
                    {userSet.image && (
                      <img
                        src={userSet.image}
                        alt={userSet.name}
                        className="w-24 h-24 sm:w-12 sm:h-12 xl:w-24 xl:h-24 object-contain rounded border shrink-0"
                      />
                    )}
                    <div>
                      <CardTitle className="text-lg">{userSet.name}</CardTitle>
                      <p className="text-muted-foreground">
                        {intl.formatMessage({
                          id: "page.collection.sets.card.description",
                          defaultMessage: "View and manage cards in this set.",
                        })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </TabsContent>
  );
}
