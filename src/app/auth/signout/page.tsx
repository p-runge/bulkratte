import { signOut } from "@/lib/auth";
import { SignOutForm } from "./_components/signout-form";

interface SignOutPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function SignOutPage({ searchParams }: SignOutPageProps) {
  const { callbackUrl } = await searchParams;

  async function handleSignOut() {
    "use server";
    await signOut({ 
      redirectTo: callbackUrl ?? "/" 
    });
  }

  return <SignOutForm action={handleSignOut} />;
}
