import { signIn } from "@/lib/auth";
import { SignInForm } from "./_components/signin-form";

interface SignInPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { callbackUrl } = await searchParams;

  async function handleSignIn() {
    "use server";
    await signIn("discord", { 
      redirectTo: callbackUrl ?? "/"
    });
  }

  return <SignInForm action={handleSignIn} />;
}
