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
import { Globe } from "lucide-react";

export function LanguageDropdown() {
  const { setLocale } = useLanguageStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Globe />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        {LOCALES.map((l) => (
          <DropdownMenuItem key={l} onClick={() => setLocale(l)}>
            {localeLabelMap[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const localeLabelMap: Record<Locale, string> = {
  "en-US": "English",
  "de-DE": "Deutsch",
};
