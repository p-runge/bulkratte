"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Locale, LOCALES } from "@/lib/i18n";
import { useLanguageStore } from "@/lib/i18n/client";
import pokemonAPI from "@/lib/pokemon-api";

export function LanguageDropdown() {
  const { locale, setLocale } = useLanguageStore();

  const localeToLanguageCode: Record<Locale, string> = {
    "en-US": "en",
    "de-DE": "de",
  };

  const currentLanguageCode = localeToLanguageCode[locale];
  const currentLanguage = pokemonAPI.cardLanguages.find(
    (lang) => lang.code === currentLanguageCode,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <span className="text-xl">{currentLanguage?.flag || "🇺🇸"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {LOCALES.map((l) => {
          const languageCode = localeToLanguageCode[l];
          const language = pokemonAPI.cardLanguages.find(
            (lang) => lang.code === languageCode,
          );
          return (
            <DropdownMenuItem key={l} onClick={() => setLocale(l)}>
              <span className="text-xl">{language?.flag || "🇺🇸"}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
