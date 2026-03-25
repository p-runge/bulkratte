import { api, HydrateClient } from "@/lib/api/server";
import { Suspense } from "react";
import CollectionTabs from "./_components/collection-tabs";

export default async function CollectionPage() {
  void api.userSet.getList.prefetch();
  void api.userCard.getList.prefetch();
  void api.userCard.getWantlist.prefetch({
    sortBy: "set-and-number",
    sortOrder: "asc",
  });
  void api.card.getFilterOptions.prefetch();

  return (
    <HydrateClient>
      <Suspense>
        <CollectionTabs />
      </Suspense>
    </HydrateClient>
  );
}
