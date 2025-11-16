"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function SignOutPage() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";

  useEffect(() => {
    void signOut({ callbackUrl });
  }, [callbackUrl]);

  return null;
}
