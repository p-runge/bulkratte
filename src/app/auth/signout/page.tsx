"use client";

import Loader from "@/components/loader";
import { handleSignOut } from "@/lib/auth/actions";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useIntl } from "react-intl";

export default function SignOutPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");

  const intl = useIntl();

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.requestSubmit();
  }, []);

  return (
    <form ref={formRef} action={() => handleSignOut(callbackUrl)}>
      <div className="flex min-h-screen items-center justify-center">
        <Loader>
          {intl.formatMessage({
            id: "signingOut",
            defaultMessage: "Signing out...",
          })}
        </Loader>
      </div>
    </form>
  );
}
