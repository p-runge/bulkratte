import { Button } from "@/components/ui/button";
import { commonMessages } from "@/lib/i18n/common-messages";
import { getIntl } from "@/lib/i18n/server";
import { Session } from "next-auth";
import Image from "next/image";
import Link from "next/link";
import { DarkModeToggle } from "../dark-mode-toggle";
import { LanguageDropdown } from "../language-dropdown";
import { MobileMenuButton } from "./mobile-menu/button";

export default async function HeaderContent({
  session,
}: {
  session: Session | null;
}) {
  const intl = await getIntl();

  return (
    <div className="container mx-auto px-4 py-4 flex justify-between items-center">
      {/* Left section */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center text-2xl font-bold gap-2">
          <Image
            src="/bulkratte_head_logo.png"
            alt={intl.formatMessage(commonMessages.logoAlt)}
            width={80}
            height={80}
            className="-my-4 drop-shadow-[0_0_3px] drop-shadow-primary"
          />
        </Link>
        {/* Only show on md+ */}
        <div className="hidden md:flex items-center gap-2">
          <LanguageDropdown />
          <DarkModeToggle />
        </div>
      </div>

      {/* Desktop navigation */}
      <div className="hidden md:flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost">
            {intl.formatMessage({
              id: "nav.link.home",
              defaultMessage: "Home",
            })}
          </Button>
        </Link>
        <Link href="/sets">
          <Button variant="ghost">
            {intl.formatMessage({
              id: "nav.link.sets",
              defaultMessage: "Sets",
            })}
          </Button>
        </Link>
        {session && (
          <Link href="/collection">
            <Button variant="ghost">
              {intl.formatMessage({
                id: "nav.link.collection",
                defaultMessage: "My Collection",
              })}
            </Button>
          </Link>
        )}
        {session ? (
          <Link href="/auth/signout">
            <Button variant="default">
              {intl.formatMessage({
                id: "nav.action.signout",
                defaultMessage: "Sign Out",
              })}
            </Button>
          </Link>
        ) : (
          <Link href="/auth/signin">
            <Button variant="default">
              {intl.formatMessage({
                id: "nav.action.signin",
                defaultMessage: "Sign In",
              })}
            </Button>
          </Link>
        )}
      </div>

      {/* Mobile hamburger */}
      <div className="md:hidden flex items-center gap-2">
        <LanguageDropdown />
        <DarkModeToggle />
        <MobileMenuButton />
      </div>
    </div>
  );
}
