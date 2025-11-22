import { auth } from "@/lib/auth";
import HeaderContent from "./content";
import { MobileMenuContent } from "./mobile-menu/content";
import { MobileMenuProvider } from "./mobile-menu/provider";
import { MobileMenuWrapper } from "./mobile-menu/wrapper";

export async function Header() {
  const session = await auth();

  return (
    <header className="relative shadow-sm border-b">
      <MobileMenuProvider>
        <HeaderContent session={session} />
        <MobileMenuWrapper>
          <MobileMenuContent session={session} />
        </MobileMenuWrapper>
      </MobileMenuProvider>
    </header>
  );
}
