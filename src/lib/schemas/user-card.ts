import { conditionEnum, languageEnum, variantEnum } from "@/lib/db/enums";
import z from "zod";

export const userCardBaseSchema = z.object({
  language: z.enum(languageEnum.enumValues).nullable(),
  variant: z.enum(variantEnum.enumValues).nullable(),
  condition: z.enum(conditionEnum.enumValues).nullable(),
});

export const userCardFormSchema = userCardBaseSchema.extend({
  notes: z.string().optional(),
});
