import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The sign-in cookie holds "<session id>.<HMAC of the id>" (ported from portfolio-v3). The id
 * is a random 32-byte value; the database keeps only its SHA-256 (auth_sessions.id_hash). The
 * signature means a forged or altered cookie is turned away before any database lookup, which
 * is what lets src/proxy.ts check it cheaply.
 */

/** Each device stays signed in for a year. */
export const SESSION_TTL_SECONDS = 365 * 24 * 60 * 60;

/** __Host- means: Secure, Path=/, no Domain, so no other site or subdomain can set it. */
export const SESSION_COOKIE = "__Host-michi_session";

export function newSessionId(): string {
  return randomBytes(32).toString("base64url");
}

/** What auth_sessions stores instead of the id. */
export function hashSessionId(id: string): string {
  return createHash("sha256").update(id).digest("base64url");
}

function sign(id: string, secret: string): string {
  return createHmac("sha256", secret).update(`michi-session:${id}`).digest("base64url");
}

export function signSession(id: string, secret: string): string {
  return `${id}.${sign(id, secret)}`;
}

/** Returns the session id if the signature checks out, otherwise null. */
export function verifySessionToken(token: string | undefined, secret: string): string | null {
  if (!token || token.length > 200) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  if (!/^[A-Za-z0-9_-]{43}$/.test(id)) return null;
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(id, secret));
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}

/** The signing key, or null when it's missing or too short to trust. */
export function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}
