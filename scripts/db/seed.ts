// fetch sets from external API and insert into the database
import { env } from "@/env";
import { cardsTable, db, setsTable } from "@/lib/db";
import { Rarity } from "@/lib/db/enums";
import pokemonAPI from "@/lib/pokemon-api";
import TCGdex from "@tcgdex/sdk";

export async function fetchAndStoreSets(withCards = true) {
  console.log("Fetching and storing sets...");
  try {
    const sets = await pokemonAPI.fetchPokemonSets();
    console.log(`Fetched ${sets.length} full sets from the API.`);

    for (const set of sets) {
      console.log(`Storing set: ${set.name} (${set.id})`, set);
      await db
        .insert(setsTable)
        .values({
          id: set.id,
          name: set.name,
          logo: set.logo,
          symbol: set.symbol,
          releaseDate: set.releaseDate,
          total: set.total,
          totalWithSecretRares: set.totalWithSecretRares,
          series: set.series,
        })
        .onConflictDoUpdate({
          target: setsTable.id,
          set: {
            updated_at: new Date().toISOString(),
            name: set.name,
            logo: set.logo,
            symbol: set.symbol,
            releaseDate: set.releaseDate,
            total: set.total,
            totalWithSecretRares: set.totalWithSecretRares,
            series: set.series,
          },
        });
      console.log(`Stored set: ${set.name} (${set.id})`);

      if (withCards) await fetchAndStoreCards(set.id);
    }

    console.log("Sets have been successfully fetched and stored.");
  } catch (error) {
    console.error("Error fetching or storing sets:", error);
  }
}

export async function fetchAndStoreCards(setId: string) {
  console.log("Fetching and storing cards...");
  try {
    const cards = await pokemonAPI.fetchPokemonCards(setId);
    const rawSet = await new TCGdex("en").set.get(setId);
    console.log(`Fetched ${cards.length} cards from the API.`);
    console.log("cards", cards);

    for (const card of cards) {
      console.log(`Storing card: ${card.name} (${card.id})`, card);
      await db
        .insert(cardsTable)
        .values({
          id: card.id,
          name: card.name,
          number: card.number,
          rarity: card.rarity as Rarity,
          imageSmall:
            card.images?.small ??
            pokemonAPI.getImageUrl(
              "en",
              rawSet!.serie.id,
              setId,
              card.number,
              "small",
            ),
          imageLarge:
            card.images?.large ??
            pokemonAPI.getImageUrl(
              "en",
              rawSet!.serie.id,
              setId,
              card.number,
              "large",
            ),
          setId: card.set.id,
        })
        .onConflictDoUpdate({
          target: cardsTable.id,
          set: {
            name: card.name,
            number: card.number,
            rarity: card.rarity as Rarity,
            imageSmall:
              card.images?.small ??
              pokemonAPI.getImageUrl(
                "en",
                rawSet!.serie.id,
                setId,
                card.number,
                "small",
              ),
            imageLarge:
              card.images?.large ??
              pokemonAPI.getImageUrl(
                "en",
                rawSet!.serie.id,
                setId,
                card.number,
                "large",
              ),
            setId: card.set.id,
          },
        });
      console.log(`Stored card: ${card.name} (${card.id})`);
    }

    console.log("Cards have been successfully fetched and stored.");
  } catch (error) {
    console.error("Error fetching or storing cards:", error);
  }
}

async function run() {
  const dbHost = env.DATABASE_URL
    ? env.DATABASE_URL.split("@")[1]?.split("/")[0]?.split(":")[0]
    : "unknown host";
  const dbUser = env.DATABASE_URL
    ? env.DATABASE_URL.split("//")[1]?.split(":")[0]
    : "unknown user";

  if (dbHost !== "localhost") {
    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(
        `⚠️  WARNING: You are about to seed a non-local database\n${dbUser}@${dbHost}\nDo you want to proceed? (y/N): `,
        (answer) => {
          rl.close();
          resolve(answer);
        },
      );
    });

    if (answer.toLowerCase() !== "y") {
      console.log("❌  Seeding cancelled.");
      process.exit(0);
    }
  }

  console.log(
    "Starting to seed database with sets and cards from external API...",
  );

  await fetchAndStoreSets();
  console.log("✅  Seeding completed!");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
