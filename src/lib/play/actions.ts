"use server";

import { ipAddress } from "@vercel/functions";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { deleteGuest, getDb, renamePlayer, setGuestHidden } from "@/db/play";
import { BOARD_TAG } from "@/lib/games/leaderboard";

import { checkGuest, makeGuest } from "./guests";
import { cleanName, nameKey, nameProblem } from "./names";
import { currentPlayer, endPlayerSession, startPlayerSession } from "./player";

/** What the guest sheet shows after a try: the player's name, or what went wrong. */
export type PlayerState = { name?: string; error?: string };

async function clientAddress(): Promise<string> {
  const h = await headers();
  return ipAddress(h) ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

/** "New name": makes a guest with a name and a 4-digit PIN and signs this device in. */
export async function createPlayer(_prev: PlayerState, form: FormData): Promise<PlayerState> {
  const result = await makeGuest(getDb(), text(form, "name"), text(form, "pin"), await clientAddress());
  if ("error" in result) return { error: result.error };
  await startPlayerSession(result.player.id);
  return { name: result.player.name };
}

/** "Sign in": an existing guest's name and PIN. */
export async function signInPlayer(_prev: PlayerState, form: FormData): Promise<PlayerState> {
  const result = await checkGuest(getDb(), text(form, "name"), text(form, "pin"), await clientAddress());
  if ("error" in result) return { error: result.error };
  await startPlayerSession(result.player.id);
  return { name: result.player.name };
}

/** Signs this device's guest out. Their name and scores stay. */
export async function signOutPlayer(): Promise<void> {
  await endPlayerSession();
}

/** A guest deletes their own name and every score (decision F). */
export async function deleteMe(): Promise<PlayerState> {
  const player = await currentPlayer();
  if (!player || player.isOwner) return { error: "There's no guest name signed in here." };
  await deleteGuest(getDb(), player.id);
  await endPlayerSession();
  revalidateTag(BOARD_TAG, { expire: 0 });
  return {};
}

/** Harshal's name on the boards (decision D). */
export async function renameOwner(_prev: PlayerState, form: FormData): Promise<PlayerState> {
  const player = await currentPlayer();
  if (!player?.isOwner) return { error: "Only Harshal can do this." };
  const raw = text(form, "name");
  const problem = nameProblem(raw);
  // Harshal can keep the reserved "Harshal" itself.
  if (problem && nameKey(raw) !== "harshal") return { error: problem };
  const name = cleanName(raw);
  if (!(await renamePlayer(getDb(), player.id, name, nameKey(name)))) return { error: "Another player has that name." };
  revalidateTag(BOARD_TAG, { expire: 0 });
  return { name };
}

/** Harshal hides a guest's name from the boards, or shows it again (decision E). */
export async function hidePlayer(_prev: PlayerState, form: FormData): Promise<PlayerState> {
  const player = await currentPlayer();
  if (!player?.isOwner) return { error: "Only Harshal can do this." };
  const hidden = text(form, "hidden") !== "false";
  if (!(await setGuestHidden(getDb(), nameKey(text(form, "name")), hidden))) return { error: "There's no guest by that name." };
  revalidateTag(BOARD_TAG, { expire: 0 });
  return { name: cleanName(text(form, "name")) };
}
