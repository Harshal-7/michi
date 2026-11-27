import { type NextRequest, NextResponse } from "next/server";

import { SIGN_IN_REQUIRED } from "@/lib/auth/required";
import { SESSION_COOKIE, sessionSecret, verifySessionToken } from "@/lib/auth/token";

/** The public games (/play) and their API: open to everyone, signed in or not. */
export function isPublicPath(pathname: string): boolean {
  return ["/play", "/api/play"].some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

/**
 * Turns signed-out requests away early: a signed-out visit to / goes to the games at /play,
 * another page to /sign-in, an API call gets a 401. It only checks the cookie's signature (no
 * database); pages, Server Actions and Route Handlers check the session itself again
 * (src/lib/auth/session.ts).
 */
export function proxy(request: NextRequest) {
  if (!SIGN_IN_REQUIRED) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();
  const secret = sessionSecret();
  if (secret && verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret)) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  // A Server Action posts to the page it's on; it answers "signed out" itself.
  if (request.method !== "GET" && request.method !== "HEAD") return NextResponse.next();

  if (pathname === "/") return NextResponse.redirect(new URL("/play", request.url));
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the sign-in page, Next's own files, and what an installed app or the
  // browser fetches without a cookie (manifest, icons). /play is let through in proxy() itself,
  // so a look-alike path such as /playlist still needs signing in.
  matcher: [
    "/((?!sign-in|_next/static|_next/image|favicon\\.ico|icon\\.svg|apple-icon\\.png|icons/|manifest\\.webmanifest|robots\\.txt).*)",
  ],
};
