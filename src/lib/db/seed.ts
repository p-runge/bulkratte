// Shared seeding logic — used by scripts/db/seed.ts and src/app/api/cron/seed/route.ts
import { cardPricesTable, cardsTable, db, setsTable } from "@/lib/db";
import { Rarity } from "@/lib/db/enums";
import { cardImageUrl } from "@/lib/core-image";
import pokemonAPI from "@/lib/pokemon-api";
import TCGdex from "@tcgdex/sdk";
import { eq } from "drizzle-orm";

export async function fetchAndStoreSets(withCards = true) {
  console.log("Fetching and storing sets...");
  try {
    // Load existing set IDs from DB in one query
    const existingSets = await db.select({ id: setsTable.id }).from(setsTable);
    const existingSetIds = new Set(existingSets.map((s) => s.id));
    console.log(`${existingSetIds.size} sets already in DB.`);

    // Fetch only lightweight stubs from the API (no per-set requests yet)
    const tcgdexEn = new TCGdex("en");
    const setStubs = await tcgdexEn.set.list();
    console.log(`Fetched ${setStubs.length} sets from API.`);

    const newSetStubs = setStubs.filter((s) => !existingSetIds.has(s.id));
    console.log(`${newSetStubs.length} new sets to insert.`);

    if (newSetStubs.length === 0) {
      console.log("✅ All sets are already up to date.");
      return;
    }

    for (const stub of newSetStubs) {
      const set = await stub.getSet();
      const mappedSet = {
        id: set.id,
        name: set.name,
        logo: set.logo ? `${set.logo}.webp` : null,
        symbol: set.symbol ? `${set.symbol}.webp` : null,
        releaseDate: set.releaseDate,
        total: set.cardCount.official,
        totalWithSecretRares: set.cardCount.total,
        series: set.serie.name,
      };

      console.log(`Storing set: ${mappedSet.name} (${mappedSet.id})`);
      await db
        .insert(setsTable)
        .values(mappedSet)
        .onConflictDoUpdate({
          target: setsTable.id,
          set: {
            updated_at: new Date().toISOString(),
            ...mappedSet,
          },
        });
      console.log(`Stored set: ${mappedSet.name} (${mappedSet.id})`);

      if (withCards) await fetchAndStoreCards(mappedSet.id);
    }

    console.log("Sets have been successfully fetched and stored.");
  } catch (error) {
    console.error("Error fetching or storing sets:", error);
    throw error;
  }
}

export async function fetchAndStoreCards(setId: string) {
  console.log(`Fetching and storing cards for set ${setId}...`);
  try {
    // Load existing card IDs for this set from DB
    const existingCards = await db
      .select({ id: cardsTable.id })
      .from(cardsTable)
      .where(eq(cardsTable.setId, setId));
    const existingCardIds = new Set(existingCards.map((c) => c.id));

    const cards = await pokemonAPI.fetchPokemonCards(setId);
    const newCards = cards.filter((c) => !existingCardIds.has(c.id));
    console.log(
      `Fetched ${cards.length} cards from API, ${existingCardIds.size} already in DB, ${newCards.length} new.`,
    );

    if (newCards.length === 0) {
      console.log(`✅ All cards for set ${setId} are already up to date.`);
      return;
    }

    for (const card of newCards) {
      if (!card.images) {
        console.warn(
          `⚠️  Skipping card ${card.name} (${card.id}): no images available`,
        );
        continue;
      }

      console.log(`Storing card: ${card.name} (${card.id})`);
      await db
        .insert(cardsTable)
        .values({
          id: card.id,
          name: card.name,
          number: card.number,
          rarity: card.rarity as Rarity,
          image: cardImageUrl(card.id),
          setId: card.set.id,
        })
        .onConflictDoUpdate({
          target: cardsTable.id,
          set: {
            name: card.name,
            number: card.number,
            rarity: card.rarity as Rarity,
            image: cardImageUrl(card.id),
            setId: card.set.id,
          },
        });
      console.log(`Stored card: ${card.name} (${card.id})`);
    }

    console.log(`Cards for set ${setId} have been successfully stored.`);
  } catch (error) {
    console.error("Error fetching or storing cards:", error);
    throw error;
  }
}

const PRICE_BATCH_SIZE = 50;

export async function fetchAndStoreAllPrices() {
  console.log("Fetching and storing prices for all cards...");
  try {
    const allCards = await db.select({ id: cardsTable.id }).from(cardsTable);
    console.log(`Updating prices for ${allCards.length} cards...`);

    for (let i = 0; i < allCards.length; i += PRICE_BATCH_SIZE) {
      const batch = allCards.slice(i, i + PRICE_BATCH_SIZE);
      await Promise.all(
        batch.map(async ({ id }) => {
          try {
            const price = await pokemonAPI.fetchPriceForCard(id);
            if (price !== null) {
              await db
                .insert(cardPricesTable)
                .values({ card_id: id, price })
                .onConflictDoUpdate({
                  target: cardPricesTable.card_id,
                  set: { price, updated_at: new Date().toISOString() },
                });
            }
          } catch (e) {
            console.error(`Error fetching price for card ${id}:`, e);
          }
        }),
      );
      console.log(
        `Prices: ${Math.min(i + PRICE_BATCH_SIZE, allCards.length)} / ${allCards.length}`,
      );
    }

    console.log("✅ All prices have been successfully updated.");
  } catch (error) {
    console.error("Error fetching or storing prices:", error);
    throw error;
  }
}
