import type { Language } from "@/lib/db/enums";

export const commonMessages = {
  logoAlt: {
    id: "common.logo.alt",
    defaultMessage: "Bulkratte Logo",
  },
} as const;

export const languageMessages: Record<
  Language,
  { id: string; defaultMessage: string }
> = {
  en: { id: "common.language.en", defaultMessage: "English" },
  fr: { id: "common.language.fr", defaultMessage: "French" },
  de: { id: "common.language.de", defaultMessage: "German" },
  it: { id: "common.language.it", defaultMessage: "Italian" },
  es: { id: "common.language.es", defaultMessage: "Spanish" },
  pt: { id: "common.language.pt", defaultMessage: "Portuguese" },
};
