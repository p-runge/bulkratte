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
  images: { small: string; large: string };
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
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "zh", name: "Chinese", flag: "🇨🇳" },
];

function getCardLanguageInfo(languageCode: SupportedLanguages) {
  return (
    cardLanguages.find((l) => l.code === languageCode) || cardLanguages[0]!
  );
}

// Card conditions with colors for quick visual identification
const conditions = [
  {
    value: "M",
    label: "Mint",
    color: "bg-green-100 text-green-800 border-green-200",
  },
  {
    value: "NM",
    label: "Near Mint",
    color: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    value: "EX",
    label: "Excellent",
    color: "bg-cyan-100 text-cyan-800 border-cyan-200",
  },
  {
    value: "LP",
    label: "Light Played",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  {
    value: "MP",
    label: "Moderately Played",
    color: "bg-orange-100 text-orange-800 border-orange-200",
  },
  {
    value: "HP",
    label: "Heavily Played",
    color: "bg-red-100 text-red-800 border-red-200",
  },
  {
    value: "D",
    label: "Damaged",
    color: "bg-gray-100 text-gray-800 border-gray-200",
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
  return ["Normal", "1st Edition", "Shadowless", "Reverse Holo"];
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
        } satisfies PokemonSet)
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
  languageCode: SupportedLanguages
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
        } satisfies PokemonSet)
    );
  });
}

async function fetchPokemonCardsForLanguage(
  setId: string,
  languageCode: SupportedLanguages
): Promise<PokemonCard[]> {
  const langTcgdex = new TCGdex(languageCode);
  const set = await langTcgdex.set.get(setId);
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
};
export default pokemonAPI;
