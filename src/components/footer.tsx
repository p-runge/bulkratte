"use client";

import Link from "next/link";
import { useIntl } from "react-intl";

export function Footer() {
  const intl = useIntl();

  return (
    <footer className="border-t py-6 text-center text-sm text-muted-foreground">
      <p>
        © {new Date().getFullYear()} Bulkratte ·{" "}
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
