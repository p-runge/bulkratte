import { PrivacyPolicyDe } from "./_content/de";
import { PrivacyPolicyEn } from "./_content/en";
import { getServerLocale } from "@/lib/i18n/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return {
    title:
      locale === "de-DE"
        ? "Datenschutzerklärung – Bulkratte"
        : "Privacy Policy – Bulkratte",
  };
}

export default async function PrivacyPage() {
  const locale = await getServerLocale();
  return locale === "de-DE" ? <PrivacyPolicyDe /> : <PrivacyPolicyEn />;
}
