import { Button } from "@/components/ui/button";
import { getIntl } from "@/lib/i18n/server";
import { Session } from "next-auth";
import Link from "next/link";

export async function MobileMenuContent({ session }: { session: Session | null }) {
  const intl = await getIntl();

  return (
    <div className="absolute z-10 w-full flex flex-col md:hidden bg-background border-t border-border px-4 py-2 space-y-2">
      <Link href="/"
      // onClick={() => setIsOpen(false)}
      >
        <Button variant="ghost" className="w-full text-left">{intl.formatMessage({ id: "nav.link.home", defaultMessage: "Home" })}</Button>
      </Link>
      <Link href="/sets"
      // onClick(() => setIsOpen(false)}
      >
        <Button variant="ghost" className="w-full text-left">{intl.formatMessage({ id: "nav.link.sets", defaultMessage: "Sets" })}</Button>
      </Link>
      {session && (
        <Link href="/collection"
        // onClick={() => setIsOpen(false)}
        >
          <Button variant="ghost" className="w-full text-left">{intl.formatMessage({ id: "nav.link.collection", defaultMessage: "My Collection" })}</Button>
        </Link>
      )}
      {session ? (
        <Link href="/auth/signout"
        // onClick={() => setIsOpen(false)}
        >
          <Button variant="default" className="w-full text-left">{intl.formatMessage({ id: "nav.action.signout", defaultMessage: "Sign Out" })}</Button>
        </Link>
      ) : (
        <Link href="/auth/signin"
        // onClick={() => setIsOpen(false)}
        >
          <Button variant="default" className="w-full text-left">{intl.formatMessage({ id: "nav.action.signin", defaultMessage: "Sign In" })}</Button>
        </Link>
      )}
    </div>
  );
}
