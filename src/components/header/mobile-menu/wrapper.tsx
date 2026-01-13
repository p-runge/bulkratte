"use client";

import { useMobileMenu } from "./provider";

export function MobileMenuWrapper({ children }: { children: React.ReactNode }) {
  const { open } = useMobileMenu();

  return open && children;
}
