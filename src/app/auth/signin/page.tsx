"use client";

import Loader from "@/components/loader";
import { handleSignIn } from "@/lib/auth/actions";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.requestSubmit();
  }, []);

  return (
    <form ref={formRef} action={() => handleSignIn(callbackUrl)}>
      <div className="flex min-h-screen items-center justify-center">
        <Loader>Redirecting to Discord...</Loader>
      </div>
    </form>
  );
}
