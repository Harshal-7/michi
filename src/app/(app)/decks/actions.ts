"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db/client";
import { requireSession } from "@/lib/auth/session";
import { studyDate } from "@/lib/day";
import { setCardSuspended, setDeckOn, setDeckPace } from "@/lib/srs/decks";

const id = z.int().positive();

export async function switchDeck(deckId: number, on: boolean): Promise<void> {
  await requireSession();
  await setDeckOn(getDb(), id.parse(deckId), z.boolean().parse(on), studyDate());
  refresh();
}

const Pace = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("deadline") }),
  z.object({ mode: z.literal("per_day"), perDay: z.int().min(1).max(50) }),
]);

export async function saveDeckPace(deckId: number, pace: z.input<typeof Pace>): Promise<{ ok: true } | { error: string }> {
  await requireSession();
  const parsed = Pace.safeParse(pace);
  if (!parsed.success) return { error: "Pick between 1 and 50 a day." };
  await setDeckPace(getDb(), id.parse(deckId), parsed.data);
  refresh();
  return { ok: true };
}

export async function suspendCard(cardId: number, suspended: boolean): Promise<void> {
  await requireSession();
  await setCardSuspended(getDb(), id.parse(cardId), z.boolean().parse(suspended));
  refresh();
}
