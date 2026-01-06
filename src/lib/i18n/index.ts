import german from "@/lib/i18n/compiled/de-DE.json";
import english from "@/lib/i18n/compiled/en-US.json";
import { ComponentProps } from "react";
import { IntlProvider } from "react-intl";

export const LOCALES = ["en-US", "de-DE"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en-US";

export const BROWSER_LANGUAGES: Record<string, Locale> = {
  en: "en-US",
  de: "de-DE",
} as const;

export const messages: Record<
  Locale,
  ComponentProps<typeof IntlProvider>["messages"]
> = {
  "de-DE": german,
  "en-US": english,
};
