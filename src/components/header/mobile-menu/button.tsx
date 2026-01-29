"use client";

import { useMobileMenu } from "./provider";
import { Menu, X } from "lucide-react";

export function MobileMenuButton() {
  const { open, toggle } = useMobileMenu();

  return (
    <button
      aria-expanded={open}
      onClick={toggle}
      className="md:hidden p-2 rounded-md bg-background hover:bg-primary hover:text-primary-foreground transition-colors"
    >
      {open ? <X size={24} /> : <Menu size={24} />}
    </button>
  );
}
