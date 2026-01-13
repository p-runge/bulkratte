"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type MobileMenuContextType = {
  open: boolean;
  toggle: () => void;
};

const MobileMenuContext = createContext<MobileMenuContextType | undefined>(
  undefined,
);
export function useMobileMenu() {
  const context = useContext(MobileMenuContext);
  if (context === undefined) {
    throw new Error("useMobileMenu must be used within a MobileMenuProvider");
  }

  return context;
}

export function MobileMenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((o) => !o);

  return (
    <MobileMenuContext.Provider value={{ open, toggle }}>
      {children}
    </MobileMenuContext.Provider>
  );
}
