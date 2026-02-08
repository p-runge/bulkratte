import pokemonAPI, { CardLanguage } from "@/lib/pokemon-api";

interface LanguageBadgeProps {
  code: CardLanguage["code"];
  className?: string;
}

export function LanguageBadge({ code, className }: LanguageBadgeProps) {
  const language = pokemonAPI.getCardLanguageInfo(code);

  return (
    <span className={className} title={language.name}>
      {language.flag}
    </span>
  );
}
