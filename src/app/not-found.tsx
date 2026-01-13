import { Button } from "@/components/ui/button";
import { commonMessages } from "@/lib/i18n/common-messages";
import { getIntl } from "@/lib/i18n/server";
import Image from "next/image";
import Link from "next/link";

export default async function NotFound() {
  const intl = await getIntl();

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
          <h1 className="text-5xl lg:text-6xl font-bold text-primary">404</h1>
          <h2 className="text-2xl lg:text-3xl font-semibold text-foreground">
            {intl.formatMessage({
              id: "page.not_found.title",
              defaultMessage: "Page Not Found",
            })}
          </h2>
          <p className="text-base lg:text-lg text-muted-foreground max-w-md">
            {intl.formatMessage({
              id: "page.not_found.description",
              defaultMessage:
                "Oops! This page still seems to be missing from your collection.",
            })}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-2">
            <Link href="/">
              <Button size="lg" variant="default">
                {intl.formatMessage({
                  id: "page.not_found.action.home",
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
