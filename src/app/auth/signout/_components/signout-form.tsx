"use client";

import { useEffect, useRef } from "react";

interface SignOutFormProps {
  action: () => Promise<void>;
}

export function SignOutForm({ action }: SignOutFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.requestSubmit();
  }, []);

  return (
    <form ref={formRef} action={action}>
      <div className="flex min-h-screen items-center justify-center">
        <p>Signing out...</p>
      </div>
    </form>
  );
}
