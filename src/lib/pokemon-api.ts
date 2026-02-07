import TCGdex, { SupportedLanguages } from "@tcgdex/sdk";

// Instantiate the SDK with your preferred language
const tcgdex = new TCGdex("en");

export type PokemonSet = {
  id: string;
  name: string;
  series: string;
  logo: string | null;
  symbol: string | null;
  releaseDate: string;
  total: number;
  totalWithSecretRares: number;
  variants: string[];
};

export type PokemonCard = {
  id: string;
  name: string;
  number: string;
  rarity: string;
  set: { id: string; name: string };
  images?: { small: string; large: string };
  // supertype: string;
  // subtypes: string[];
};

const cardLanguages = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "jp", name: "Japanese", flag: "🇯🇵" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "zh", name: "Chinese", flag: "🇨🇳" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
];

function getCardLanguageInfo(languageCode: SupportedLanguages) {
  return (
    cardLanguages.find((l) => l.code === languageCode) || cardLanguages[0]!
  );
}

// Card conditions with colors for quick visual identification
const conditions = [
  {
    value: "Mint",
    short: "MT",
    color: "bg-blue-500 text-white border-blue-600",
  },
  {
    value: "Near Mint",
    short: "NM",
    color: "bg-green-500 text-white border-green-600",
  },
  {
    value: "Excellent",
    short: "EX",
    color: "bg-lime-500 text-white border-lime-600",
  },
  {
    value: "Good",
    short: "GD",
    color: "bg-yellow-500 text-white border-yellow-600",
  },
  {
    value: "Light Played",
    short: "LP",
    color: "bg-orange-500 text-white border-orange-600",
  },
  {
    value: "Played",
    short: "PL",
    color: "bg-red-600 text-white border-red-700",
  },
  {
    value: "Poor",
    short: "PO",
    color: "bg-red-400 text-white border-red-500",
  },
];

function getConditionInfo(condition: string) {
  return conditions.find((c) => c.value === condition) || conditions[1]!;
}

/**
 * This would require a top-level await which is not possible in this env.
 * Instead we are using a static snapshot of that endpoint's response.
 */
// const rarities = (await tcgdex.rarity.list()).map((r) => r.toString());
const rarities = [
  "ACE SPEC Rare",
  "Amazing Rare",
  "Black White Rare",
  "Classic Collection",
  "Common",
  "Crown",
  "Double rare",
  "Four Diamond",
  "Full Art Trainer",
  "Holo Rare",
  "Holo Rare V",
  "Holo Rare VMAX",
  "Holo Rare VSTAR",
  "Hyper rare",
  "Illustration rare",
  "LEGEND",
  "None",
  "One Diamond",
  "One Shiny",
  "One Star",
  "Radiant Rare",
  "Rare",
  "Rare Holo",
  "Rare Holo LV.X",
  "Rare PRIME",
  "Secret Rare",
  "Shiny Ultra Rare",
  "Shiny rare",
  "Shiny rare V",
  "Shiny rare VMAX",
  "Special illustration rare",
  "Three Diamond",
  "Three Star",
  "Two Diamond",
  "Two Shiny",
  "Two Star",
  "Ultra Rare",
  "Uncommon",
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getVariants(_setId: string): string[] {
  // TODO: add map for setId to variants
  return ["Unlimited", "1st Edition", "Shadowless", "Reverse Holo"];
}

async function fetchPokemonSets(): Promise<PokemonSet[]> {
  return tcgdex.set.list().then(async (sets) => {
    console.log(`Fetched set list with ${sets.length} sets from API.`);
    const fullSets = await Promise.all(sets.map(async (set) => set.getSet()));

    return fullSets.map(
      (set) =>
        ({
          id: set.id,
          name: set.name,
          series: set.serie.name,
          logo: set.logo ? `${set.logo}.webp` : null,
          symbol: set.symbol ? `${set.symbol}.webp` : null,
          releaseDate: set.releaseDate,
          total: set.cardCount.official,
          totalWithSecretRares: set.cardCount.total,
          variants: getVariants(set.id),
        }) satisfies PokemonSet,
    );
  });
}

async function fetchPokemonCards(setId: string): Promise<PokemonCard[]> {
  const set = await tcgdex.set.get(setId);
  if (!set) return [];

  const fullCards = await Promise.all(set.cards.map((card) => card.getCard()));

  return fullCards.map((card) => ({
    id: card.id,
    name: card.name,
    number: card.localId,
    rarity: card.rarity,
    set: { id: card.set.id, name: card.set.name },
    images: {
      small: `https://assets.tcgdex.net/en/${set.serie.id}/${setId}/${card.localId}/low.webp`,
      large: `https://assets.tcgdex.net/en/${set.serie.id}/${setId}/${card.localId}/high.webp`,
    },
  }));
}

// Language-specific fetch functions for localization
async function fetchPokemonSetsForLanguage(
  languageCode: SupportedLanguages,
): Promise<PokemonSet[]> {
  const langTcgdex = new TCGdex(languageCode);
  return langTcgdex.set.list().then(async (sets) => {
    console.log(`Fetched set list with ${sets.length} sets from API.`);
    const fullSets = await Promise.all(sets.map(async (set) => set.getSet()));

    return fullSets.map(
      (set) =>
        ({
          id: set.id,
          name: set.name,
          series: set.serie.name,
          logo: set.logo ? `${set.logo}.webp` : null,
          symbol: set.symbol ? `${set.symbol}.webp` : null,
          releaseDate: set.releaseDate,
          total: set.cardCount.official,
          totalWithSecretRares: set.cardCount.total,
          variants: getVariants(set.id),
        }) satisfies PokemonSet,
    );
  });
}

async function fetchPokemonCardsForLanguage(
  setId: string,
  languageCode: SupportedLanguages,
): Promise<PokemonCard[]> {
  const langTcgdex = new TCGdex(languageCode);
  const set = await langTcgdex.set.get(setId);
  if (!set) return [];

  const testImage = await fetch(
    pokemonAPI.getImageUrl(languageCode, set.serie.id, setId, "1", "small"),
  );

  const fullCards = await Promise.all(set.cards.map((card) => card.getCard()));

  return fullCards.map((card) => ({
    id: card.id,
    name: card.name,
    number: card.localId,
    rarity: card.rarity,
    set: { id: card.set.id, name: card.set.name },
    images: testImage.ok
      ? {
          small: getImageUrl(
            languageCode,
            set.serie.id,
            setId,
            card.localId,
            "small",
          ),
          large: getImageUrl(
            languageCode,
            set.serie.id,
            setId,
            card.localId,
            "large",
          ),
        }
      : undefined,
  }));
}

function getImageUrl(
  languageCode: SupportedLanguages,
  seriesId: string,
  setId: string,
  cardNumber: string,
  size: "small" | "large",
): string {
  const sizePath = size === "small" ? "low" : "high";
  return `https://assets.tcgdex.net/${languageCode}/${seriesId}/${setId}/${cardNumber}/${sizePath}.webp`;
}

async function fetchPriceForCard(cardId: string): Promise<number | null> {
  return tcgdex.card.get(cardId).then(async (card) => {
    if (!card) return null;

    // @ts-expect-error -- pricing is not yet typed in tcgdex sdk
    const priceInEur: number | undefined = card.pricing?.cardmarket?.avg7;

    // parse EUR (float) value to cents (integer)
    return priceInEur ? Math.floor(priceInEur * 100) : null;
  });
}

const pokemonAPI = {
  cardLanguages,
  getCardLanguageInfo,
  conditions,
  getConditionInfo,
  rarities,
  getVariants,
  fetchPokemonSets,
  fetchPokemonCards,
  fetchPokemonSetsForLanguage,
  fetchPokemonCardsForLanguage,
  getImageUrl,
  fetchPriceForCard,
};
export default pokemonAPI;
