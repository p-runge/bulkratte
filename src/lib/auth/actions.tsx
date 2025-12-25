"use server"

import "server-only";

import { signIn, signOut } from ".";

export async function handleSignIn(callbackUrl: string | null) {
  "use server";
  // redirect to default sign in page of NextAuth
  await signIn(undefined, {
    redirectTo: callbackUrl ?? "/"
  });
}

export async function handleSignOut(callbackUrl: string | null) {
  "use server";
  await signOut({
    redirectTo: callbackUrl ?? "/"
  });
}
