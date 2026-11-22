import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { createSession, deleteSession, findSession, type SessionRow } from "@/db/auth";
import { getDb } from "@/db/client";

import { SIGN_IN_REQUIRED } from "./required";
import { hashSessionId, newSessionId, SESSION_COOKIE, SESSION_TTL_SECONDS, sessionSecret, signSession, verifySessionToken } from "./token";

/**
 * The signed-in check. src/proxy.ts turns away a missing or forged cookie early; every page,
 * Server Action and Route Handler then checks the session in the database again:
 * - pages: `await requireSignedIn()` (redirects to /sign-in)
 * - Server Actions: `await requireSession()` (throws NotSignedInError)
 * - Route Handlers: `if (!(await currentSession())) return unauthorized()`
 */

export class NotSignedInError extends Error {
  constructor() {
    super("You were signed out. Reload the page and sign in again.");
  }
}

export type Session = Pick<SessionRow, "device" | "createdAt" | "expiresAt">;

/** Plain-language list of what's missing, shown on the sign-in page. */
export function authSetupProblems(): string[] {
  const problems: string[] = [];
  if (!process.env.DATABASE_URL) problems.push("DATABASE_URL isn't set: connect Neon in Vercel → Storage.");
  if (!process.env.PASSPHRASE_HASH?.startsWith("scrypt:")) {
    problems.push("PASSPHRASE_HASH isn't set: the scrambled form of your passphrase (pnpm auth:hash).");
  }
  if (!sessionSecret()) problems.push("SESSION_SECRET isn't set: the key that signs the sign-in cookie (pnpm auth:secret).");
  return problems;
}

async function cookieSessionId(): Promise<string | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value, secret);
}

/** Every request's session while sign-in is switched off (src/lib/auth/required.ts). */
const OPEN_SESSION: Session = { device: "device", createdAt: new Date(0), expiresAt: new Date(8.64e15) };

/** This request's session, or null. Looked up once per request. */
export const currentSession = cache(async (): Promise<Session | null> => {
  if (!SIGN_IN_REQUIRED) {
    // Reading the cookie is what made every page render per request. Without it Next prerenders
    // pages at build time and Vercel serves those copies, so Today shows the build's numbers.
    await connection();
    return OPEN_SESSION;
  }
  const id = await cookieSessionId();
  if (!id || !process.env.DATABASE_URL) return null;
  const row = await findSession(getDb(), hashSessionId(id));
  return row && { device: row.device, createdAt: row.createdAt, expiresAt: row.expiresAt };
});

/** First line of every page. */
export async function requireSignedIn(): Promise<Session> {
  const session = await currentSession();
  if (!session) redirect("/sign-in");
  return session;
}

/** First line of every Server Action. */
export async function requireSession(): Promise<Session> {
  const session = await currentSession();
  if (!session) throw new NotSignedInError();
  return session;
}

/** For Route Handlers. */
export function unauthorized(): Response {
  return Response.json({ error: "Sign in first." }, { status: 401 });
}

const COOKIE_BASE = {
  httpOnly: true,
  secure: true,
  // Lax, not strict: opening Michi from a link or the installed app still sends the cookie,
  // while other sites' form posts don't.
  sameSite: "lax",
  path: "/",
} as const;

/** Server Actions and Route Handlers only (it sets a cookie). */
export async function startSession(device: string): Promise<void> {
  const secret = sessionSecret();
  if (!secret) throw new Error("SESSION_SECRET isn't set.");
  const id = newSessionId();
  await createSession(getDb(), hashSessionId(id), device);
  (await cookies()).set(SESSION_COOKIE, signSession(id, secret), { ...COOKIE_BASE, maxAge: SESSION_TTL_SECONDS });
}

/** Server Actions and Route Handlers only (it clears a cookie). */
export async function endSession(): Promise<void> {
  const id = await cookieSessionId();
  if (id && process.env.DATABASE_URL) await deleteSession(getDb(), hashSessionId(id));
  // A __Host- cookie can only be cleared with the same Secure and Path=/ it was set with.
  (await cookies()).set(SESSION_COOKIE, "", { ...COOKIE_BASE, maxAge: 0 });
}
