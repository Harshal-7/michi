"use server";

import { refresh } from "next/cache";

import { getDb } from "@/db/client";
import { requireSession } from "@/lib/auth/session";
import { SavedGame, saveGame } from "@/lib/kana-game/data";

/** Saves a finished kana game. Safe to send twice: the game's id is made on the device. */
export async function saveKanaGame(game: unknown): Promise<{ ok: boolean }> {
  await requireSession();
  const parsed = SavedGame.safeParse(game);
  if (!parsed.success) return { ok: false };
  await saveGame(getDb(), parsed.data);
  refresh();
  return { ok: true };
}
