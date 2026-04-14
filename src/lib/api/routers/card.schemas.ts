import { z } from "zod";

import { rarityEnum } from "@/lib/db/enums";

export const cardFilterOptionsSchema = z.object({
  setIds: z.array(z.string()),
  rarities: z.array(z.string()),
});

export const cardsByIdsSchema = z.array(
  z.object({
    id: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    name: z.string(),
    number: z.string(),
    rarity: z.enum(rarityEnum.enumValues).nullable(),
    image: z.string(),
    setId: z.string(),
  }),
);
