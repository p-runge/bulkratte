"use client"

import { BROWSER_LANGUAGES, DEFAULT_LOCALE, Locale, LOCALES, messages } from '@/lib/i18n';
import { IntlProvider } from 'react-intl';
import { create } from "zustand";
import { persist } from "zustand/middleware";

export function I18nProvider({
  children,
  serverLocale,
}: {
  children: React.ReactNode;
  serverLocale: Locale;
}) {
  // Server locale already reflects user's preference via cookie/middleware
  // So we can use it directly without causing hydration issues
  const locale = serverLocale;

  return (
    <IntlProvider locale={locale} messages={messages[locale]} defaultLocale={DEFAULT_LOCALE} onError={(error) => {
      if (error.code === 'MISSING_TRANSLATION') {
        // Suppress missing translation errors
        return;
      }

      console.error(error);
    }}>
      {children}
    </IntlProvider>
  )
}


function getInitialLocale() {
  // Only access navigator on client
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  let locale: Locale;

  if (LOCALES.includes(navigator.language as Locale)) {
    locale = navigator.language as Locale;
  } else {
    const languageCode = navigator.language.split("-")[0]!;
    locale =
      BROWSER_LANGUAGES[languageCode] || DEFAULT_LOCALE;
  }

  return locale;
}

type LanguageState = {
  locale: Locale;
  setLocale: (locale?: Locale | "auto") => void;
};

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      locale: getInitialLocale(),
      setLocale: (locale) => {
        const validLocale =
          !locale || locale === "auto" ? getInitialLocale() : locale;
        document.documentElement.lang = validLocale.substring(0, 2);

        // used for server-side rendering to detect preferred locale
        document.cookie = `preferred-locale=${locale}; path=/`;

        set({ locale: validLocale });

        // Trigger a page reload to re-render server components
        window.location.reload();
      },
    }),
    {
      name: "language-storage",
    }
  )
);
