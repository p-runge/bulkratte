import HeaderContent from "./content";
import { MobileMenuContent } from "./mobile-menu/content";
import { MobileMenuProvider } from "./mobile-menu/provider";
import { MobileMenuWrapper } from "./mobile-menu/wrapper";

export function Header() {
  return (
    <header className="relative shadow-sm border-b">
      <MobileMenuProvider>
        <HeaderContent />
        <MobileMenuWrapper>
          <MobileMenuContent />
        </MobileMenuWrapper>
      </MobileMenuProvider>
    </header>
  );
}
