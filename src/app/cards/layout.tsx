import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="container mx-auto flex-1 px-4 py-8">{children}</main>
      <Footer />
    </div>
  );
}
