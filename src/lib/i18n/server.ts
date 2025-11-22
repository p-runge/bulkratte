import { headers } from "next/headers";
import { createIntl } from "react-intl";
import {
  BROWSER_LANGUAGES,
  DEFAULT_LOCALE,
  Locale,
  LOCALES,
  messages,
} from ".";

export async function getServerLocale(): Promise<Locale> {
  const acceptLanguage = (await headers()).get("accept-language") || "";
  const headerLocale = acceptLanguage;
  const languageCode = headerLocale.split("-")[0]!;

  if (LOCALES.includes(headerLocale)) {
    // exact match
    return headerLocale as Locale;
  } else if (BROWSER_LANGUAGES[languageCode]) {
    // matches core language code -> use mapped locale
    return BROWSER_LANGUAGES[languageCode]! as Locale;
  } else {
    // fallback to default locale
    return DEFAULT_LOCALE;
  }
}

export async function getIntl() {
  const locale = await getServerLocale();

  return createIntl({
    locale,
    messages: messages[locale],
  });
}
