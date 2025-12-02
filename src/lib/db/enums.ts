import { pgEnum } from "drizzle-orm/pg-core";

export const rarityEnum = pgEnum("rarity", [
  "Common",
  "Uncommon",
  "Rare",
  "Ultra Rare",
  "None",
  "Secret Rare",
  "One Diamond",
  "Illustration rare",
  "Two Diamond",
  "Rare Holo",
  "Holo Rare",
  "Double rare",
  "Holo Rare V",
  "Shiny rare",
  "Three Diamond",
  "Two Star",
  "Special illustration rare",
  "One Star",
  "Holo Rare VMAX",
  "Four Diamond",
  "One Shiny",
  "Hyper rare",
  "Rare Holo LV.X",
  "ACE SPEC Rare",
  "Holo Rare VSTAR",
  "Two Shiny",
  "Rare PRIME",
  "Classic Collection",
  "LEGEND",
  "Three Star",
  "Radiant Rare",
  "Crown",
  "Shiny Ultra Rare",
  "Shiny rare V",
  "Amazing Rare",
  "Shiny rare VMAX",
  "Full Art Trainer",
  "Black White Rare",
  "Mega Hyper Rare",
]);
export type Rarity = (typeof rarityEnum.enumValues)[number];

export const conditionEnum = pgEnum("condition", [
  "Mint",
  "Near Mint",
  "Excellent",
  "Good",
  "Light Played",
  "Played",
  "Poor",
]);
export type Condition = (typeof conditionEnum.enumValues)[number];

export const variantEnum = pgEnum("variant", [
  "Unlimited",
  "1st Edition",
  "Shadowless",
  "1st Edition Shadowless",
  "Reverse Holo",
]);
export type Variant = (typeof variantEnum.enumValues)[number];

export const languageEnum = pgEnum("language", [
  "en",
  "fr",
  "de",
  "it",
  "es",
  "pt",
  "jp",
  "ko",
  "zh",
  "ru",
]);
export type Language = (typeof languageEnum.enumValues)[number];
