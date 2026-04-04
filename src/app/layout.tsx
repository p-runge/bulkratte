import { TRPCReactProvider } from "@/lib/api/react";
import { DeviceSync } from "@/lib/hooks";
import { I18nProvider } from "@/lib/i18n/client";
import { getServerLocale } from "@/lib/i18n/server";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/providers/theme-provider";
import { UiPreferencesProvider } from "@/providers/ui-preferences-provider";
import "@total-typescript/ts-reset";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import PlausibleProvider from "next-plausible";
import { SessionProvider } from "next-auth/react";
import NextTopLoader from "nextjs-toploader";
import type React from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bulkratte",
  description:
    "Bulkratte is the easiest way to track your Pokémon card collection. Manage sets in multiple languages, variants, and conditions with ease.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const serverLocale = await getServerLocale();
  const lang = serverLocale.substring(0, 2);

  return (
    <html lang={lang} suppressHydrationWarning>
      <body>
        <NextTopLoader showSpinner={false} color="#C6A96B" />
        <DeviceSync />
        <SessionProvider>
          <PlausibleProvider domain="bulkratte.de">
            <TRPCReactProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                <I18nProvider serverLocale={serverLocale}>
                  <UiPreferencesProvider>
                    {children}
                    <Toaster />
                  </UiPreferencesProvider>
                </I18nProvider>
              </ThemeProvider>
            </TRPCReactProvider>
          </PlausibleProvider>
        </SessionProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
