import { z } from "zod";

import {
  conditionEnum,
  languageEnum,
  rarityEnum,
  variantEnum,
} from "@/lib/db/enums";

const coverCropObjectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const cachedCardSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  name: z.string(),
  number: z.string(),
  rarity: z.enum(rarityEnum.enumValues).nullable(),
  image: z.string(),
  setId: z.string(),
  price: z.number().optional(),
  setReleaseDate: z.string().nullable().optional(),
});

const language = z.enum(languageEnum.enumValues).nullable();
const variant = z.enum(variantEnum.enumValues).nullable();
const condition = z.enum(conditionEnum.enumValues).nullable();

export const userCardListSchema = z.array(
  z.object({
    id: z.string(),
    language,
    variant,
    condition,
    notes: z.string().nullable(),
    card: cachedCardSchema,
    localizedName: z.string().nullable(),
    photos: z.array(z.string()),
    coverPhoto: z.string().nullable(),
    coverCrop: coverCropObjectSchema.nullable(),
  }),
);

export const userCardWantlistSchema = z.array(
  z.object({
    id: z.string(),
    cardId: z.string(),
    language,
    variant,
    condition,
    notes: z.null(),
    card: cachedCardSchema,
    localizedName: z.string().nullable(),
    photos: z.array(z.string()),
    coverPhoto: z.string().nullable(),
    coverCrop: coverCropObjectSchema.nullable(),
  }),
);
