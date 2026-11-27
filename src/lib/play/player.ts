import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { createPlayerSession, deletePlayerSession, findPlayerSession, getDb, ownerPlayer, type Player } from "@/db/play";
import { SIGN_IN_REQUIRED } from "@/lib/auth/required";
import { currentSession } from "@/lib/auth/session";
import { hashSessionId, newSessionId, PLAYER_COOKIE, SESSION_TTL_SECONDS, sessionSecret, signSession, verifySessionToken } from "@/lib/auth/token";

export type { Player };

async function cookiePlayerSessionId(): Promise<string | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  return verifySessionToken((await cookies()).get(PLAYER_COOKIE)?.value, secret, "michi-player");
}

/**
 * Who's playing, once per request:
 * - Harshal, when their passphrase session is on this device (the owner row; no PIN);
 * - otherwise the guest the `__Host-michi_player` cookie names;
 * - otherwise nobody: they can play, and "Save your score" asks for a name.
 */
export const currentPlayer = cache(async (): Promise<Player | null> => {
  if (!process.env.DATABASE_URL) return null;
  const db = getDb();
  if (SIGN_IN_REQUIRED && (await currentSession())) return ownerPlayer(db);
  const id = await cookiePlayerSessionId();
  return id ? findPlayerSession(db, hashSessionId(id)) : null;
});

const COOKIE_BASE = { httpOnly: true, secure: true, sameSite: "lax", path: "/" } as const;

/** Server Actions only (it sets a cookie): signs this device in as the guest. */
export async function startPlayerSession(playerId: string): Promise<void> {
  const secret = sessionSecret();
  if (!secret) throw new Error("SESSION_SECRET isn't set.");
  const id = newSessionId();
  await createPlayerSession(getDb(), hashSessionId(id), playerId);
  (await cookies()).set(PLAYER_COOKIE, signSession(id, secret, "michi-player"), { ...COOKIE_BASE, maxAge: SESSION_TTL_SECONDS });
}

/** Server Actions only (it clears a cookie): signs this device's guest out. */
export async function endPlayerSession(): Promise<void> {
  const id = await cookiePlayerSessionId();
  if (id && process.env.DATABASE_URL) await deletePlayerSession(getDb(), hashSessionId(id));
  (await cookies()).set(PLAYER_COOKIE, "", { ...COOKIE_BASE, maxAge: 0 });
}
