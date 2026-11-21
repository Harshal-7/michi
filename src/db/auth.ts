/** Signed-in devices and recent sign-in tries, in Postgres (no Redis). */
import { and, count, desc, eq, gt, lt } from "drizzle-orm";

import { SESSION_TTL_SECONDS } from "@/lib/auth/token";

import type { DbOrTx } from "./client";
import { authSessions, signInAttempts } from "./schema";

/** After this many wrong tries from one address, sign-in pauses for the window. */
export const MAX_WRONG_TRIES = 5;
/** Tries from everyone together, so a spread-out guesser is slowed down too. */
export const MAX_ALL_TRIES = 100;
export const WINDOW_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether `key` (the IP address) may try now: fewer than 5 wrong tries since its last right
 * one in the last 15 minutes, and fewer than 100 tries from everyone.
 */
export async function signInAllowed(db: DbOrTx, key: string, now = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - WINDOW_MS);
  const recent = await db
    .select({ ok: signInAttempts.ok })
    .from(signInAttempts)
    .where(and(eq(signInAttempts.key, key), gt(signInAttempts.at, since)))
    .orderBy(desc(signInAttempts.at), desc(signInAttempts.id))
    .limit(MAX_WRONG_TRIES + 1);
  const lastRight = recent.findIndex((r) => r.ok);
  const wrong = lastRight === -1 ? recent.length : lastRight;
  if (wrong >= MAX_WRONG_TRIES) return false;
  const [all] = await db.select({ n: count() }).from(signInAttempts).where(gt(signInAttempts.at, since));
  return all.n < MAX_ALL_TRIES;
}

export async function recordSignInAttempt(db: DbOrTx, key: string, ok: boolean, now = new Date()): Promise<void> {
  await db.insert(signInAttempts).values({ key, ok, at: now });
  // Keep the table small: tries older than a day don't count for anything.
  await db.delete(signInAttempts).where(lt(signInAttempts.at, new Date(now.getTime() - DAY_MS)));
}

export type SessionRow = typeof authSessions.$inferSelect;

export async function createSession(db: DbOrTx, idHash: string, device: string, now = new Date()): Promise<void> {
  await db.insert(authSessions).values({
    idHash,
    device,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_SECONDS * 1000),
  });
  await db.delete(authSessions).where(lt(authSessions.expiresAt, now));
}

/** The session if it exists and hasn't expired. Marks it seen at most once a day. */
export async function findSession(db: DbOrTx, idHash: string, now = new Date()): Promise<SessionRow | null> {
  const [row] = await db
    .select()
    .from(authSessions)
    .where(and(eq(authSessions.idHash, idHash), gt(authSessions.expiresAt, now)));
  if (!row) return null;
  if (now.getTime() - row.lastSeenAt.getTime() > DAY_MS) {
    await db.update(authSessions).set({ lastSeenAt: now }).where(eq(authSessions.idHash, idHash));
  }
  return row;
}

export async function deleteSession(db: DbOrTx, idHash: string): Promise<void> {
  await db.delete(authSessions).where(eq(authSessions.idHash, idHash));
}
