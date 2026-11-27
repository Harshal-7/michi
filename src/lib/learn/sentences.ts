/**
 * Your own sentences and notes on a grammar lesson (F_GrammarPoint, "My sentences" and "Notes").
 *
 * A sentence is stored like the content's examples: Japanese with the grammar part marked once
 * as the fill-in answer ("ゆっくり{話|はな}し[[てください]]。", see content/schema.ts). It joins the
 * point's fill-in card and the quiz only once you mark it checked (decision 16); editing its
 * Japanese unchecks it again.
 */
import { and, asc, eq, inArray } from "drizzle-orm";

import type { DbOrTx } from "@/db/client";
import { grammarProgress, items, userSentences } from "@/db/schema";

import { markPart, type MySentence } from "./sentence-parts";

export { defaultPart, markPart, type MySentence, splitPart } from "./sentence-parts";

export type Mine = { sentences: MySentence[]; notes: string };

const isGrammar = async (db: DbOrTx, itemId: number) => {
  const [row] = await db.select({ kind: items.kind }).from(items).where(eq(items.id, itemId));
  return row?.kind === "grammar";
};

/** A lesson's sentences, oldest first, and its notes. */
export async function loadMine(db: DbOrTx, itemId: number): Promise<Mine> {
  const [sentences, [progress]] = await Promise.all([
    db
      .select({ id: userSentences.id, ja: userSentences.ja, en: userSentences.en, checked: userSentences.checked })
      .from(userSentences)
      .where(eq(userSentences.itemId, itemId))
      .orderBy(asc(userSentences.id)),
    db.select({ notes: grammarProgress.notes }).from(grammarProgress).where(eq(grammarProgress.itemId, itemId)),
  ]);
  return { sentences, notes: progress?.notes ?? "" };
}

export type SentenceInput = { sentence: string; part: string; en: string };
type Result = { ok: true } | { error: string };

export async function addSentence(db: DbOrTx, itemId: number, input: SentenceInput): Promise<Result> {
  const marked = markPart(input.sentence, input.part);
  if ("error" in marked) return marked;
  if (!(await isGrammar(db, itemId))) return { error: "That grammar point isn't there any more." };
  await db.insert(userSentences).values({ itemId, ja: marked.ja, en: input.en.trim() });
  return { ok: true };
}

/** Changes a sentence. New Japanese unchecks it, so it's checked again before the quiz uses it. */
export async function editSentence(db: DbOrTx, id: number, input: SentenceInput): Promise<Result> {
  const marked = markPart(input.sentence, input.part);
  if ("error" in marked) return marked;
  const [row] = await db.select({ ja: userSentences.ja, checked: userSentences.checked }).from(userSentences).where(eq(userSentences.id, id));
  if (!row) return { error: "That sentence isn't there any more." };
  const checked = row.checked && row.ja === marked.ja;
  await db.update(userSentences).set({ ja: marked.ja, en: input.en.trim(), checked }).where(eq(userSentences.id, id));
  return { ok: true };
}

export async function deleteSentence(db: DbOrTx, id: number): Promise<void> {
  await db.delete(userSentences).where(eq(userSentences.id, id));
}

export async function setChecked(db: DbOrTx, id: number, checked: boolean): Promise<void> {
  await db.update(userSentences).set({ checked }).where(eq(userSentences.id, id));
}

/** Saves a lesson's notes, keeping its status. */
export async function setNotes(db: DbOrTx, itemId: number, notes: string): Promise<Result> {
  if (!(await isGrammar(db, itemId))) return { error: "That grammar point isn't there any more." };
  await db
    .insert(grammarProgress)
    .values({ itemId, notes })
    .onConflictDoUpdate({ target: grammarProgress.itemId, set: { notes, updatedAt: new Date() } });
  return { ok: true };
}

/**
 * The checked sentences of each item, oldest first, as fill-in examples (`{ ja, en }`). Unchecked
 * sentences are never in it. Items without any are left out of the map.
 */
export async function checkedSentencesFor(db: DbOrTx, itemIds: readonly number[]): Promise<Map<number, { ja: string; en: string }[]>> {
  const out = new Map<number, { ja: string; en: string }[]>();
  if (itemIds.length === 0) return out;
  const rows = await db
    .select({ itemId: userSentences.itemId, ja: userSentences.ja, en: userSentences.en })
    .from(userSentences)
    .where(and(inArray(userSentences.itemId, [...new Set(itemIds)]), eq(userSentences.checked, true)))
    .orderBy(asc(userSentences.itemId), asc(userSentences.id));
  for (const r of rows) {
    const list = out.get(r.itemId) ?? [];
    list.push({ ja: r.ja, en: r.en });
    out.set(r.itemId, list);
  }
  return out;
}
