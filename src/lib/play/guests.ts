/**
 * Making a guest and signing one in with their name and PIN, with the limits from decision F:
 * 5 wrong PINs on a name means a 15-minute wait, 20 wrong from one address the same, and an
 * address can make 10 names in 15 minutes. The PIN is scrambled with the passphrase's scrypt.
 */
import { PLAY_KEY_PREFIX, recordSignInAttempt, signInAllowed } from "@/db/auth";
import type { DbOrTx } from "@/db/client";
import { createGuest, findGuest, type Player } from "@/db/play";
import { hashPassphrase, verifyPassphrase } from "@/lib/auth/password";

import { cleanName, cleanPin, nameKey, nameProblem, pinProblem } from "./names";

/** Wrong PINs from one address, over every name, before it waits too. */
export const MAX_WRONG_PER_ADDRESS = 20;
/** New names from one address in 15 minutes. */
export const MAX_NEW_PER_ADDRESS = 10;

export const WAIT_MESSAGE = "Too many tries. Wait 15 minutes, then try again.";
export const NO_MATCH = "That name and PIN don't match.";

const keys = (ip: string, key = "") => ({
  name: `${PLAY_KEY_PREFIX}name:${key}`,
  address: `${PLAY_KEY_PREFIX}ip:${ip}`,
  made: `${PLAY_KEY_PREFIX}new:${ip}`,
});

export type GuestResult = { player: Player } | { error: string };

/** A new guest with this name and PIN, or why not. */
export async function makeGuest(db: DbOrTx, rawName: string, rawPin: string, ip: string, now = new Date()): Promise<GuestResult> {
  const problem = nameProblem(rawName) ?? pinProblem(rawPin);
  if (problem) return { error: problem };
  const k = keys(ip);
  if (!(await signInAllowed(db, k.made, now, MAX_NEW_PER_ADDRESS))) return { error: WAIT_MESSAGE };
  const name = cleanName(rawName);
  const player = await createGuest(db, name, nameKey(name), await hashPassphrase(cleanPin(rawPin)));
  if (!player) return { error: "That name is taken. Try another, or sign in if it's yours." };
  // Counted as a "wrong" try so every new name counts towards the address's limit.
  await recordSignInAttempt(db, k.made, false, now);
  return { player };
}

/** The guest with this name and PIN, or why not. */
export async function checkGuest(db: DbOrTx, rawName: string, rawPin: string, ip: string, now = new Date()): Promise<GuestResult> {
  const key = nameKey(rawName);
  const k = keys(ip, key);
  if (!(await signInAllowed(db, k.name, now)) || !(await signInAllowed(db, k.address, now, MAX_WRONG_PER_ADDRESS))) {
    return { error: WAIT_MESSAGE };
  }
  const guest = pinProblem(rawPin) ? null : await findGuest(db, key);
  // No such name still costs a scrypt, so a name that exists doesn't answer faster.
  const ok = await verifyPassphrase(cleanPin(rawPin), guest?.pinHash ?? DUMMY_HASH);
  const right = ok && guest !== null;
  await recordSignInAttempt(db, k.name, right, now);
  await recordSignInAttempt(db, k.address, right, now);
  if (!right) return { error: NO_MATCH };
  return { player: { id: guest.id, name: guest.name, isOwner: guest.isOwner, hidden: guest.hidden } };
}

/** A well-formed hash of nothing anyone can type, for names that don't exist. */
const DUMMY_HASH = "scrypt:32768:8:1:AAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
