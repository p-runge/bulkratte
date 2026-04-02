// Shared seeding logic — used by scripts/db/seed.ts and src/app/api/cron/seed/route.ts
import { cardPricesTable, cardsTable, db, setsTable } from "@/lib/db";
import { Rarity } from "@/lib/db/enums";
import pokemonAPI from "@/lib/pokemon-api";
import TCGdex from "@tcgdex/sdk";
import { eq, isNull, sql } from "drizzle-orm";

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
          imageSmall: card.images.small,
          imageLarge: card.images.large,
          setId: card.set.id,
          attacks: card.attacks.length > 0 ? card.attacks : null,
          abilities: card.abilities.length > 0 ? card.abilities : null,
        })
        .onConflictDoUpdate({
          target: cardsTable.id,
          set: {
            name: card.name,
            number: card.number,
            rarity: card.rarity as Rarity,
            imageSmall: card.images.small,
            imageLarge: card.images.large,
            setId: card.set.id,
            attacks: card.attacks.length > 0 ? card.attacks : null,
            abilities: card.abilities.length > 0 ? card.abilities : null,
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

const ATTACKS_BATCH_SIZE = 10;

/**
 * Backfills attacks and abilities for all cards that currently have NULL values.
 * Processes cards grouped by set so we can reuse the set fetch per group.
 */
export async function backfillAttacksAndAbilities() {
  console.log("Backfilling attacks and abilities for existing cards...");
  try {
    const tcgdexEn = new TCGdex("en");

    // Find all sets that have at least one card missing attacks/abilities
    const setsToUpdate = await db
      .selectDistinct({ setId: cardsTable.setId })
      .from(cardsTable)
      .where(isNull(cardsTable.attacks));

    console.log(
      `Found ${setsToUpdate.length} sets with cards missing attacks/abilities.`,
    );

    let totalUpdated = 0;

    for (const { setId } of setsToUpdate) {
      console.log(`Processing set ${setId}...`);
      try {
        const set = await tcgdexEn.set.get(setId);
        if (!set) {
          console.warn(`  ⚠️  Set ${setId} not found in TCGDex, skipping.`);
          continue;
        }

        const cardStubs = set.cards;
        for (let i = 0; i < cardStubs.length; i += ATTACKS_BATCH_SIZE) {
          const batch = cardStubs.slice(i, i + ATTACKS_BATCH_SIZE);
          await Promise.all(
            batch.map(async (stub) => {
              try {
                const card = await stub.getCard();
                const attacks = (card.attacks ?? []).map((a) => a.name);
                const abilities = (card.abilities ?? []).map((a) => a.name);
                await db
                  .update(cardsTable)
                  .set({
                    attacks: attacks.length > 0 ? attacks : sql`'[]'::jsonb`,
                    abilities:
                      abilities.length > 0 ? abilities : sql`'[]'::jsonb`,
                    updated_at: new Date().toISOString(),
                  })
                  .where(eq(cardsTable.id, card.id));
                totalUpdated++;
              } catch (e) {
                console.error(
                  `  Error fetching card ${stub.id} in set ${setId}:`,
                  e,
                );
              }
            }),
          );
        }
        console.log(
          `  ✅ Set ${setId} done (${cardStubs.length} cards processed).`,
        );
      } catch (e) {
        console.error(`  Error processing set ${setId}:`, e);
      }
    }

    console.log(
      `✅ Backfill complete. Updated attacks/abilities for ${totalUpdated} cards.`,
    );
  } catch (error) {
    console.error("Error during attacks/abilities backfill:", error);
    throw error;
  }
}
