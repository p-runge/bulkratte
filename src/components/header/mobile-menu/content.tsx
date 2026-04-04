"use client";

import { useSession } from "next-auth/react";
import { useIntl } from "react-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function MobileMenuContent() {
  const { data: session } = useSession();
  const intl = useIntl();

  return (
    <div className="absolute z-10 w-full flex flex-col md:hidden bg-background border-t border-border px-4 py-2 space-y-2">
      <Link href="/sets">
        <Button variant="ghost" className="w-full text-left">
          {intl.formatMessage({ id: "nav.link.sets", defaultMessage: "Sets" })}
        </Button>
      </Link>
      {session && (
        <>
          <Link href="/collection" prefetch={true}>
            <Button variant="ghost" className="w-full text-left">
              {intl.formatMessage({
                id: "nav.link.collection",
                defaultMessage: "My Collection",
              })}
            </Button>
          </Link>
          <Link href="/trade">
            <Button variant="ghost" className="w-full text-left">
              {intl.formatMessage({
                id: "nav.link.trade",
                defaultMessage: "Trade",
              })}
            </Button>
          </Link>
        </>
      )}
      {session ? (
        <Link href="/auth/signout">
          <Button variant="default" className="w-full text-left">
            {intl.formatMessage({
              id: "nav.action.signout",
              defaultMessage: "Sign Out",
            })}
          </Button>
        </Link>
      ) : (
        <Link href="/auth/signin">
          <Button variant="default" className="w-full text-left">
            {intl.formatMessage({
              id: "nav.action.signin",
              defaultMessage: "Sign In",
            })}
          </Button>
        </Link>
      )}
    </div>
  );
}
