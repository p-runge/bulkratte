import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { DEFAULT_LOCALE } from "./lib/i18n";

export function proxy(req: NextRequest) {
  // Redirect unauthenticated users away from /collection routes.
  // Actual session validity is enforced server-side by tRPC protectedProcedure.
  if (req.nextUrl.pathname.startsWith("/collection")) {
    const sessionToken =
      req.cookies.get("__Secure-authjs.session-token") ??
      req.cookies.get("authjs.session-token");
    if (!sessionToken) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  const modifiedHeaders = new Headers(req.headers);

  // Overwrite the "accept-language" header based on cookie value,
  // falling back to the browser's real Accept-Language header on first visit
  const preferredLocale =
    req.cookies.get("preferred-locale")?.value ||
    req.headers.get("accept-language") ||
    DEFAULT_LOCALE;
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
