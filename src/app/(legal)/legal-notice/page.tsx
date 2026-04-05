import { LegalNoticeDe } from "./_content/de";
import { LegalNoticeEn } from "./_content/en";
import { getServerLocale } from "@/lib/i18n/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return {
    title:
      locale === "de-DE" ? "Impressum – Bulkratte" : "Legal Notice – Bulkratte",
  };
}

export default async function LegalNoticePage() {
  const locale = await getServerLocale();
  return locale === "de-DE" ? <LegalNoticeDe /> : <LegalNoticeEn />;
}
