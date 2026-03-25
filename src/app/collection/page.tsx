import { api, HydrateClient } from "@/lib/api/server";
import CollectionTabs from "./_components/collection-tabs";

export default async function CollectionPage() {
  await Promise.all([
    api.userSet.getList.prefetch(),
    // MyCardsTab (empty-state check) and UserCardBrowser (filtered view) use different query keys
    api.userCard.getList.prefetch(),
    api.userCard.getList.prefetch({ sortBy: "set-and-number", sortOrder: "asc" }),
    api.userCard.getWantlist.prefetch({ sortBy: "set-and-number", sortOrder: "asc" }),
    api.card.getFilterOptions.prefetch(),
  ]);

  return (
    <HydrateClient>
      <CollectionTabs />
    </HydrateClient>
  );
}
