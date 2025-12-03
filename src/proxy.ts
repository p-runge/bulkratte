import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { DEFAULT_LOCALE } from "./lib/i18n";

export function proxy(req: NextRequest) {
  const modifiedHeaders = new Headers(req.headers);

  // Overwrite the "accept-language" header based on cookie value
  const preferredLocale =
    req.cookies.get("preferred-locale")?.value || DEFAULT_LOCALE;
  modifiedHeaders.set("accept-language", preferredLocale);

  return NextResponse.next({
    request: {
      headers: modifiedHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
