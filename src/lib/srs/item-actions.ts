"use server";

import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import { flags, items } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import { dedupeKey } from "@/lib/items/dedupe";

/**
 * "Flag this" and "Edit" from any card (decision 16). An edit sets `user_edited_at`, so the seed
 * never overwrites it.
 */

const FlagInput = z.object({
  itemId: z.int().positive(),
  cardId: z.int().positive().nullable(),
  note: z.string().trim().max(1000),
  /** What was on screen, in case the item changes later. */
  shown: z.record(z.string(), z.unknown()),
});

export async function flagItem(input: z.input<typeof FlagInput>): Promise<{ ok: true } | { error: string }> {
  await requireSession();
  const parsed = FlagInput.safeParse(input);
  if (!parsed.success) return { error: "That flag didn't check out." };
  const { itemId, cardId, note, shown } = parsed.data;
  await getDb()
    .insert(flags)
    .values({ itemId, note, target: { ...shown, cardId } });
  return { ok: true };
}

const EditInput = z.object({
  itemId: z.int().positive(),
  term: z.string().trim().min(1, "Write the term.").max(200),
  reading: z.string().trim().max(200),
  meaning: z.string().trim().max(500),
});

export type EditedItem = { term: string; reading: string | null; meaning: string };

export async function editItem(
  input: z.input<typeof EditInput>,
): Promise<{ ok: true; item: EditedItem } | { error: string }> {
  await requireSession();
  const parsed = EditInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "That edit didn't check out." };
  const { itemId, term, meaning } = parsed.data;
  const reading = parsed.data.reading || null;
  const db = getDb();
  const [item] = await db.select({ kind: items.kind }).from(items).where(eq(items.id, itemId));
  if (!item) return { error: "That item isn't there any more." };
  const key = dedupeKey(item.kind, term, reading);
  const [clash] = await db
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.kind, item.kind), eq(items.dedupeKey, key), ne(items.id, itemId)));
  if (clash) return { error: "Another item already has this term and reading." };
  await db
    .update(items)
    .set({ term, reading, meaning, dedupeKey: key, userEditedAt: new Date() })
    .where(eq(items.id, itemId));
  return { ok: true, item: { term, reading, meaning } };
}
