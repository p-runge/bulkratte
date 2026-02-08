import { Header } from "@/components/header";
import RouteGuard from "@/lib/auth/route-guard";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
