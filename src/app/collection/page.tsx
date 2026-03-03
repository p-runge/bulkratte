"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookHeart, Heart, Library } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useIntl } from "react-intl";
import MyCardsTab from "./_components/my-cards-tab";
import MySetsTab from "./_components/my-sets-tab";
import WantlistTab from "./_components/wantlist-tab";

export default function CollectionPage() {
  const intl = useIntl();
  const router = useRouter();

  const searchParams = useSearchParams();
  const m = searchParams.get("m");
  const defaultTab =
    m === "my-cards"
      ? "my-cards"
      : m === "wantlist"
        ? "wantlist"
        : "collections";

  const [activeTab, setActiveTab] = useState(defaultTab);

  function setMQueryParam(tab: string) {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "collection") {
      params.delete("m");
    } else {
      params.set("m", tab);
    }
    router.replace(`?${params.toString()}`);
  }

  return (
    <>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {intl.formatMessage({
              id: "page.collection.title",
              defaultMessage: "My Collection",
            })}
          </h1>
          <p className="text-muted-foreground">
            {intl.formatMessage({
              id: "page.collection.description",
              defaultMessage: "Track and manage your Pokémon card collection",
            })}
          </p>
        </div>
      </div>
      <Tabs
        defaultValue={defaultTab}
        className="w-full"
        onValueChange={(value) => setMQueryParam(value)}
      >
        <TabsList className="mb-6">
          <TabsTrigger value="collections">
            <span className="inline-flex items-center gap-2">
              <BookHeart className="w-4 h-4" />
              {intl.formatMessage({
                id: "page.collection.tab.sets",
                defaultMessage: "My Sets",
              })}
            </span>
          </TabsTrigger>
          <TabsTrigger value="my-cards">
            <span className="inline-flex items-center gap-2">
              <Library className="w-4 h-4" />
              {intl.formatMessage({
                id: "page.collection.tab.cards",
                defaultMessage: "My Cards",
              })}
            </span>
          </TabsTrigger>
          <TabsTrigger value="wantlist">
            <span className="inline-flex items-center gap-2">
              <Heart className="w-4 h-4" />
              {intl.formatMessage({
                id: "page.collection.tab.wantlist",
                defaultMessage: "Wantlist",
              })}
            </span>
          </TabsTrigger>
        </TabsList>
        {activeTab === "collections" && <MySetsTab />}
        {activeTab === "my-cards" && <MyCardsTab />}
        {activeTab === "wantlist" && <WantlistTab />}
      </Tabs>
    </>
  );
}
