// Shared localization seeding logic — used by scripts/db/seed-localizations.ts and src/app/api/cron/seed/route.ts
import pokemonAPI from "@/lib/pokemon-api";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n";
import { upsertLocalization } from "@/lib/db/localization";
import { db, localizationsTable } from "@/lib/db";
import TCGdex, { SupportedLanguages } from "@tcgdex/sdk";
import { eq } from "drizzle-orm";

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
    // Pre-fetch all existing localization keys for this language in one DB query
    const existingLocalizations = await db
      .select({
        table_name: localizationsTable.table_name,
        column_name: localizationsTable.column_name,
        record_id: localizationsTable.record_id,
      })
      .from(localizationsTable)
      .where(eq(localizationsTable.language, languageCode));

    const existingKeys = new Set(
      existingLocalizations.map(
        (l) => `${l.table_name}:${l.column_name}:${l.record_id}`,
      ),
    );
    const hasLocalization = (
      tableName: string,
      columnName: string,
      recordId: string,
    ) => existingKeys.has(`${tableName}:${columnName}:${recordId}`);

    // Fetch only lightweight set stubs from the API (one fast request)
    const langTcgdex = new TCGdex(languageCode);
    const setStubs = await langTcgdex.set.list();
    console.log(`  Fetched ${setStubs.length} set stubs from API`);

    let setCount = 0;
    let cardCount = 0;
    let skippedSets = 0;

    for (const stub of setStubs) {
      const setId = stub.id;

      // A "_processed" marker is written after a set completes successfully,
      // making the skip check immune to partial API coverage differences between
      // languages (e.g. English DB has cards the German API doesn't return).
      if (hasLocalization("sets", "_processed", setId)) {
        skippedSets++;
        continue;
      }

      // Fetch full set and card data only when needed
      const cards = await pokemonAPI.fetchPokemonCardsForLanguage(
        setId,
        languageCode,
      );
      const set = cards[0]?.set ?? { id: setId, name: stub.name };
      const setName = stub.name;
      const rawSet = await langTcgdex.set.get(setId);

      // Upsert set name localization if missing
      if (!hasLocalization("sets", "name", setId)) {
        await upsertLocalization("sets", "name", setId, locale, setName);
      }

      // Upsert set series localization if missing
      if (!hasLocalization("sets", "series", setId) && rawSet) {
        await upsertLocalization(
          "sets",
          "series",
          setId,
          locale,
          rawSet.serie.name,
        );
      }

      setCount++;
      console.log(
        `  ✓ Set ${setCount}: ${setName} (${setId}) — ${cards.length} cards`,
      );

      // Determine if localized images are available for this set
      let imagesAreLocalized = false;
      try {
        const testCard = cards[0];
        if (rawSet && testCard) {
          const res = await fetch(
            `https://assets.tcgdex.net/${languageCode}/${rawSet.serie.id}/${setId}/${testCard.number}/low.webp`,
          );
          imagesAreLocalized = res.ok;
        }
      } catch {
        console.warn(
          `    ⚠️  Could not find localized images for cards in set ${setId} (${setName})`,
        );
      }

      for (const card of cards) {
        // Upsert card name if missing
        if (!hasLocalization("cards", "name", card.id)) {
          await upsertLocalization("cards", "name", card.id, locale, card.name);
        }

        if (rawSet && imagesAreLocalized) {
          // Upsert card images if missing
          if (!hasLocalization("cards", "image_small", card.id)) {
            await upsertLocalization(
              "cards",
              "image_small",
              card.id,
              locale,
              `https://assets.tcgdex.net/${languageCode}/${rawSet.serie.id}/${setId}/${card.number}/low.webp`,
            );
          }
          if (!hasLocalization("cards", "image_large", card.id)) {
            await upsertLocalization(
              "cards",
              "image_large",
              card.id,
              locale,
              `https://assets.tcgdex.net/${languageCode}/${rawSet.serie.id}/${setId}/${card.number}/high.webp`,
            );
          }
          cardCount++;
        }
      }
      console.log(`    ✓ Processed ${cards.length} cards`);

      // Mark this set as fully processed for this language so future runs skip it
      await upsertLocalization("sets", "_processed", setId, locale, "1");
    }

    console.log(
      `✅ Completed ${locale}: ${setCount} sets, ${cardCount} cards localized, ${skippedSets}/${setStubs.length} sets skipped (already up to date)`,
    );
  } catch (error) {
    console.error(`❌ Error seeding localizations for ${locale}:`, error);
    throw error;
  }
}

export async function seedAllLocalizations() {
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
