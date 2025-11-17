"use client"; // Needed if we use state for mobile menu

import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react"; // For hamburger icon
import { Session } from "next-auth";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useIntl } from "react-intl";
import { DarkModeToggle } from "../dark-mode-toggle";
import { LanguageDropdown } from "../language-dropdown";

export default function HeaderContent({ session }: {
  session: Session | null;
}) {
  const intl = useIntl();
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <header className="shadow-sm border-b">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        {/* Left section */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center text-2xl font-bold gap-2"
          >
            <Image
              src="/bulkratte_head_logo.png"
              alt={
                intl.formatMessage(
                  { id: "navigation.logoAlt", defaultMessage: "{logoName} Logo" },
                  { logoName: "TCG Collector" }
                )
              }
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
            <Button variant="ghost">{intl.formatMessage({ id: "navigation.home", defaultMessage: "Home" })}</Button>
          </Link>
          <Link href="/sets">
            <Button variant="ghost">{intl.formatMessage({ id: "navigation.sets", defaultMessage: "Sets" })}</Button>
          </Link>
          {session && (
            <Link href="/collection">
              <Button variant="ghost">{intl.formatMessage({ id: "navigation.collection", defaultMessage: "My Collection" })}</Button>
            </Link>
          )}
          {session ? (
            <Link href="/auth/signout">
              <Button variant="default">{intl.formatMessage({ id: "navigation.signOut", defaultMessage: "Sign Out" })}</Button>
            </Link>
          ) : (
            <Link href="/auth/signin">
              <Button variant="default">{intl.formatMessage({ id: "navigation.signIn", defaultMessage: "Sign In" })}</Button>
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <div className="md:hidden flex items-center gap-2">
          <LanguageDropdown />
          <DarkModeToggle />
          <button onClick={toggleMenu} className="cursor-pointer p-2 rounded-md bg-background hover:bg-primary hover:text-primary-foreground transition-colors">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="absolute w-full flex flex-col md:hidden bg-background border-t border-border px-4 py-2 space-y-2">
          <Link href="/" onClick={() => setIsOpen(false)}>
            <Button variant="ghost" className="w-full text-left">{intl.formatMessage({ id: "navigation.home", defaultMessage: "Home" })}</Button>
          </Link>
          <Link href="/sets" onClick={() => setIsOpen(false)}>
            <Button variant="ghost" className="w-full text-left">{intl.formatMessage({ id: "navigation.sets", defaultMessage: "Sets" })}</Button>
          </Link>
          {session && (
            <Link href="/collection" onClick={() => setIsOpen(false)}>
              <Button variant="ghost" className="w-full text-left">{intl.formatMessage({ id: "navigation.collection", defaultMessage: "My Collection" })}</Button>
            </Link>
          )}
          {session ? (
            <Link href="/auth/signout" onClick={() => setIsOpen(false)}>
              <Button variant="default" className="w-full text-left">{intl.formatMessage({ id: "navigation.signOut", defaultMessage: "Sign Out" })}</Button>
            </Link>
          ) : (
            <Link href="/auth/signin" onClick={() => setIsOpen(false)}>
              <Button variant="default" className="w-full text-left">{intl.formatMessage({ id: "navigation.signIn", defaultMessage: "Sign In" })}</Button>
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
