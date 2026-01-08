"use client";

import { Button } from "@/components/ui/button";
import { commonMessages } from "@/lib/i18n/common-messages";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useIntl } from "react-intl";

/**
 * This component is automatically used by Next.js when an error occurs
 * in a page or layout component. No manual implementation needed.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const intl = useIntl();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col justify-center items-center px-4 bg-background">
      <div className="flex flex-col lg:flex-row lg:gap-12 items-center max-w-5xl">
        <div className="flex justify-center lg:justify-end shrink-0">
          <Image
            src="/bulkratte_logo.png"
            alt={intl.formatMessage(commonMessages.logoAlt)}
            width={280}
            height={280}
            className="drop-shadow-[0_0_10px] drop-shadow-primary opacity-90"
          />
        </div>

        <div className="space-y-4 text-center lg:text-left">
          <h1 className="text-5xl lg:text-6xl font-bold text-destructive">
            {intl.formatMessage({
              id: "page.error.heading",
              defaultMessage: "Unknown Error",
            })}
          </h1>
          <h2 className="text-2xl lg:text-3xl font-semibold text-foreground">
            {intl.formatMessage({
              id: "page.error.title",
              defaultMessage: "Something went wrong!",
            })}
          </h2>
          <p className="text-base lg:text-lg text-muted-foreground max-w-md">
            {intl.formatMessage({
              id: "page.error.description",
              defaultMessage:
                "Looks like the Bulkratte nibbled on something it better shouldn't have. But don't worry, your collection is safe!",
            })}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-2">
            <Button size="lg" variant="default" onClick={reset}>
              {intl.formatMessage({
                id: "page.error.action.retry",
                defaultMessage: "Try Again",
              })}
            </Button>
            <Link href="/">
              <Button size="lg" variant="outline">
                {intl.formatMessage({
                  id: "page.error.action.home",
                  defaultMessage: "Head Back Home",
                })}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
