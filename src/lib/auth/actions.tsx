"use server"

import "server-only";

import { signIn, signOut } from ".";

export async function handleSignIn(callbackUrl: string | null) {
  "use server";
  await signIn("discord", {
    redirectTo: callbackUrl ?? "/"
  });
}

export async function handleSignOut(callbackUrl: string | null) {
  "use server";
  await signOut({
    redirectTo: callbackUrl ?? "/"
  });
}
