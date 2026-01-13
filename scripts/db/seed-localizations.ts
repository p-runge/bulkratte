// Seed localizations for sets and cards from external API
import { env } from "@/env";
import pokemonAPI from "@/lib/pokemon-api";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n";
import { upsertLocalization } from "@/lib/db/localization";
import TCGdex, { SupportedLanguages } from "@tcgdex/sdk";

// Map locale codes to language codes used by TCGdex API
const LOCALE_TO_LANGUAGE: Record<Locale, SupportedLanguages> = {
  "de-DE": "de",
  "en-US": "en",
};

async function seedLocalizationsForLanguage(locale: Locale) {
  const languageCode = LOCALE_TO_LANGUAGE[locale];
  if (!languageCode) {
    console.warn(`⚠️  No language mapping found for locale: ${locale}`);
    return;
  }

  console.log(`\n📚 Seeding localizations for ${locale} (${languageCode})...`);

  try {
    // Use pokemonAPI to fetch all sets for this language
    const sets = await pokemonAPI.fetchPokemonSetsForLanguage(languageCode);
    console.log(`  Fetched ${sets.length} sets from API`);

    let setCount = 0;
    let cardCount = 0;

    for (const set of sets) {
      // Upsert set name localization
      await upsertLocalization("sets", "name", set.id, locale, set.name);

      // Upsert set series localization
      await upsertLocalization("sets", "series", set.id, locale, set.series);

      setCount++;
      console.log(
        `  ✓ Set ${setCount}/${sets.length}: ${set.name} (${set.series})`,
      );

      // Fetch and localize cards for this set using pokemonAPI
      const cards = await pokemonAPI.fetchPokemonCardsForLanguage(
        set.id,
        languageCode,
      );
      console.log(`  Fetched ${cards.length} cards from the API.`);

      const rawSet = await new TCGdex(languageCode).set.get(set.id);

      let imagesAreLocalized;
      try {
        const testCard = cards[0];
        if (rawSet && testCard) {
          await fetch(
            `https://assets.tcgdex.net/${languageCode}/${rawSet.serie.id}${testCard.set.id}/${testCard.number}/low.webp`,
          ).then((res) => {
            if (!res.ok) throw new Error("Image not found");
          });
          imagesAreLocalized = true;
        }
      } catch (error) {
        console.warn(
          `    ⚠️  Could not find localized images for cards in set ${set.id} (${set.name})`,
        );
        imagesAreLocalized = false;
      }

      for (const card of cards) {
        await upsertLocalization("cards", "name", card.id, locale, card.name);

        if (rawSet && imagesAreLocalized) {
          // images
          await upsertLocalization(
            "cards",
            "image_small",
            card.id,
            locale,
            `https://assets.tcgdex.net/${languageCode}/${rawSet.serie.id}/${set.id}/${card.number}/low.webp`,
          );
          await upsertLocalization(
            "cards",
            "image_large",
            card.id,
            locale,
            `https://assets.tcgdex.net/${languageCode}/${rawSet.serie.id}/${set.id}/${card.number}/high.webp`,
          );
          cardCount++;
        }
      }
      console.log(`    ✓ Localized ${cards.length} cards`);
    }

    console.log(
      `✅ Completed ${locale}: ${setCount} sets, ${cardCount} cards localized`,
    );
  } catch (error) {
    console.error(`❌ Error seeding localizations for ${locale}:`, error);
    throw error;
  }
}

async function seedAllLocalizations() {
  // Get all non-default locales
  const targetLocales = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

  console.log(
    `🌍 Starting localization seeding for ${targetLocales.length} languages`,
  );
  console.log(`   Languages: ${targetLocales.join(", ")}`);
  console.log(`   Skipping default language: ${DEFAULT_LOCALE}\n`);

  for (const locale of targetLocales) {
    await seedLocalizationsForLanguage(locale);
  }

  console.log("\n🎉 All localizations have been successfully seeded!");
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
        `⚠️  WARNING: You are about to seed localizations to a non-local database\n${dbUser}@${dbHost}\nDo you want to proceed? (y/N): `,
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
    "Starting to seed database with localizations from external API...",
  );

  await seedAllLocalizations();
  console.log("✅  Localization seeding completed!");
}

run().catch((err) => {
  console.error("❌  Fatal error:", err);
  process.exit(1);
});
