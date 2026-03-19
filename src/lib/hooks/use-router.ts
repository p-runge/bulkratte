"use client";

import { useRouter as useNextRouter } from "next/navigation";
import { useTopLoader } from "nextjs-toploader";
import { useCallback } from "react";

/**
 * Drop-in replacement for `next/navigation`'s `useRouter` that automatically
 * starts the top-loading bar on `push` and `replace`. This is necessary because
 * `nextjs-toploader` only starts the bar on `<a>` element clicks — programmatic
 * navigation via `router.push()` bypasses that handler entirely.
 */
export function useRouter() {
  const router = useNextRouter();
  const topLoader = useTopLoader();

  const push = useCallback(
    (...args: Parameters<typeof router.push>) => {
      topLoader.start();
      router.push(...args);
    },
    [router, topLoader],
  );

  const replace = useCallback(
    (...args: Parameters<typeof router.replace>) => {
      topLoader.start();
      router.replace(...args);
    },
    [router, topLoader],
  );

  return { ...router, push, replace };
}
