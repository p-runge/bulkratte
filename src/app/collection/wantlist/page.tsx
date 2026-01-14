"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WantlistRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/collection?m=wantlist");
  }, [router]);

  return null;
}
