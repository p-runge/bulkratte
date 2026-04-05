"use client";

import Link from "next/link";
import { useIntl } from "react-intl";

export function Footer() {
  const intl = useIntl();

  return (
    <footer className="border-t py-6 text-center text-sm text-muted-foreground">
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span>© {new Date().getFullYear()} Bulkratte</span>
        <span aria-hidden="true">·</span>
        <Link
          href="/legal-notice"
          className="transition-colors underline-offset-4 hover:underline hover:text-foreground"
        >
          {intl.formatMessage({
            id: "footer.legalNotice",
            defaultMessage: "Legal Notice",
          })}
        </Link>
        <span aria-hidden="true">·</span>
        <Link
          href="/privacy"
          className="transition-colors underline-offset-4 hover:underline hover:text-foreground"
        >
          {intl.formatMessage({
            id: "footer.privacyPolicy",
            defaultMessage: "Privacy Policy",
          })}
        </Link>
      </p>
    </footer>
  );
}
