"use client";

import { useEffect, useRef } from "react";

interface SignInFormProps {
  action: () => Promise<void>;
}

export function SignInForm({ action }: SignInFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.requestSubmit();
  }, []);

  return (
    <form ref={formRef} action={action}>
      <div className="flex min-h-screen items-center justify-center">
        <p>Redirecting to Discord...</p>
      </div>
    </form>
  );
}
