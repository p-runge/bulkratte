import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { LanguageDropdown } from "@/components/language-dropdown";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { commonMessages } from "@/lib/i18n/common-messages";
import { getIntl } from "@/lib/i18n/server";
import Image from "next/image";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth();
  const intl = await getIntl();

  return (
    <main className="min-h-screen flex flex-col justify-center items-center px-4">
      <div className="flex flex-col lg:flex-row lg:gap-12 items-center">
        <div className="max-w-1/2 min-w-75 flex justify-end">
          <Image src="/bulkratte_logo.png" alt={intl.formatMessage(commonMessages.logoAlt)} width={500} height={500} className="drop-shadow-[0_0_10px] drop-shadow-primary" />
        </div>
        <div className="max-w-2xl">
          <div className="mb-6 flex gap-4">
            <LanguageDropdown />
            <DarkModeToggle />
          </div>

          <h1 className="text-4xl lg:text-6xl font-bold mb-4 text-primary capitalize">{
            intl.formatMessage({
              id: "page.home.title",
              defaultMessage: "Your TCG collection under control",
            })
          }</h1>
          <p className="text-lg text-muted-foreground mb-6"
          >
            {intl.formatMessage({
              id: "page.home.description",
              defaultMessage:
                "<i>{siteName}</i> is the easiest way to track your Pokémon card collection. Manage sets in multiple languages, variants, and conditions with ease.",
            },
              {
                i: (chunks) => <i key="home.description.siteName">{chunks}</i>,
                siteName: "Bulkratte"
              }
            )}
          </p>

          {!session && <>
            <p className="mb-3 text-sm">
              {intl.formatMessage({
                id: "page.home.cta.intro",
                defaultMessage: "Not a <i>Bulkratte</i> yet? Create an account and start organizing your collection today – 100% for free!",
              },
                {
                  i: (chunks) => <i key="home.ctaIntroduction.siteName">{chunks}</i>,
                }
              )}
            </p>
            <Link href="/auth/signin" passHref>
              <Button className="cursor-pointer" variant="default" size="lg">
                {intl.formatMessage({
                  id: "page.home.action.signup",
                  defaultMessage: "Sign Up Now",
                })}
              </Button>
            </Link>
          </>}

          <hr className="my-6" />

          <div className="flex gap-3">
            <Link href="/sets" passHref className="mb-4">
              <Button className="cursor-pointer" variant="outline">
                {intl.formatMessage({
                  id: "page.home.action.browse_sets",
                  defaultMessage: "Browse Card Sets",
                })}
              </Button>
            </Link>

            {session && (
              <Link href="/collection" passHref>
                <Button className="cursor-pointer">
                  {intl.formatMessage({
                    id: "page.home.action.view_collection",
                    defaultMessage: "My Collection",
                  })}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
