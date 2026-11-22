import { type NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, sessionSecret, verifySessionToken } from "@/lib/auth/token";

/**
 * Turns signed-out requests away early: a page goes to /sign-in, an API call gets a 401.
 * It only checks the cookie's signature (no database); pages, Server Actions and Route
 * Handlers check the session itself again (src/lib/auth/session.ts).
 */
export function proxy(request: NextRequest) {
  const secret = sessionSecret();
  if (secret && verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  // A Server Action posts to the page it's on; it answers "signed out" itself.
  if (request.method !== "GET" && request.method !== "HEAD") return NextResponse.next();

  const url = new URL("/sign-in", request.url);
  if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the sign-in page, Next's own files, and what an installed app or the
  // browser fetches without a cookie (manifest, icons).
  matcher: [
    "/((?!sign-in|_next/static|_next/image|favicon\\.ico|icon\\.svg|apple-icon\\.png|icons/|manifest\\.webmanifest|robots\\.txt).*)",
  ],
};
