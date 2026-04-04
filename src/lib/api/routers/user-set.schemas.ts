import { z } from "zod";

import {
  binderLayoutEnum,
  conditionEnum,
  languageEnum,
  rarityEnum,
  variantEnum,
} from "@/lib/db/enums";

const language = z.enum(languageEnum.enumValues).nullable();
const variant = z.enum(variantEnum.enumValues).nullable();
const condition = z.enum(conditionEnum.enumValues).nullable();
const rarity = z.enum(rarityEnum.enumValues).nullable();
const binderLayout = z.enum(binderLayoutEnum.enumValues);

export const userSetListSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    image: z.string().nullable(),
    preferredLanguage: language,
    preferredVariant: variant,
    preferredCondition: condition,
    binderLayout,
    totalCards: z.number(),
    placedCards: z.number(),
  }),
);

export const userSetByIdSchema = z.object({
  set: z.object({
    id: z.string(),
    name: z.string(),
    image: z.string().nullable(),
    createdAt: z.string(),
    preferredLanguage: language,
    preferredVariant: variant,
    preferredCondition: condition,
    binderLayout,
  }),
  cards: z.array(
    z.object({
      id: z.string(),
      cardId: z.string(),
      userCardId: z.string().nullable(),
      order: z.number(),
      preferredLanguage: language,
      preferredVariant: variant,
      preferredCondition: condition,
      card: z
        .object({
          id: z.string(),
          name: z.string(),
          number: z.string(),
          rarity,
          imageSmall: z.string(),
          imageLarge: z.string(),
          setId: z.string(),
        })
        .nullable(),
    }),
  ),
});

export const placedUserCardIdsSchema = z.array(
  z.object({
    userCardId: z.string(),
    userSetId: z.string(),
    userSetCardId: z.string(),
    setName: z.string(),
  }),
);
