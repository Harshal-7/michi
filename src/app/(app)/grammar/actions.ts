"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db/client";
import { requireSession } from "@/lib/auth/session";
import { type GrammarStatus, markLessonIn, setGrammarStatus } from "@/lib/learn/grammar";
import { addSentence, deleteSentence, editSentence, setChecked, setNotes } from "@/lib/learn/sentences";

const Mark = z.object({
  opId: z.uuid(),
  itemId: z.int().positive(),
  choice: z.enum(["known", "learn"]),
  answers: z.array(z.boolean()).max(10),
});

export type MarkResult = { status: GrammarStatus; next: number | null } | { error: string };

/** "I know this" or "Learn it" at the end of a lesson; see markLessonIn. */
export async function markLesson(input: z.input<typeof Mark>): Promise<MarkResult> {
  await requireSession();
  const parsed = Mark.safeParse(input);
  if (!parsed.success) return { error: "That didn't save. Reload the page and try again." };
  const result = await markLessonIn(getDb(), parsed.data);
  refresh();
  return result;
}

const Status = z.object({ itemId: z.int().positive(), status: z.enum(["not_started", "learning", "confident"]) });

/** The status chips on a lesson. */
export async function changeStatus(itemId: number, status: GrammarStatus): Promise<void> {
  await requireSession();
  const input = Status.parse({ itemId, status });
  await setGrammarStatus(getDb(), input.itemId, input.status);
  refresh();
}

// ---------------------------------------------------------------------------
// My sentences and notes (F_GrammarPoint)

export type SaveResult = { ok: true } | { error: string };
const NOT_SAVED = "That didn't save. Reload the page and try again.";

const Sentence = z.object({
  sentence: z.string().max(300),
  part: z.string().max(100),
  en: z.string().max(300),
});

export async function addMySentence(itemId: number, input: z.input<typeof Sentence>): Promise<SaveResult> {
  await requireSession();
  const id = z.int().positive().safeParse(itemId);
  const parsed = Sentence.safeParse(input);
  if (!id.success || !parsed.success) return { error: NOT_SAVED };
  const result = await addSentence(getDb(), id.data, parsed.data);
  refresh();
  return result;
}

export async function editMySentence(sentenceId: number, input: z.input<typeof Sentence>): Promise<SaveResult> {
  await requireSession();
  const id = z.int().positive().safeParse(sentenceId);
  const parsed = Sentence.safeParse(input);
  if (!id.success || !parsed.success) return { error: NOT_SAVED };
  const result = await editSentence(getDb(), id.data, parsed.data);
  refresh();
  return result;
}

export async function deleteMySentence(sentenceId: number): Promise<void> {
  await requireSession();
  await deleteSentence(getDb(), z.int().positive().parse(sentenceId));
  refresh();
}

/** "Mark as checked", and taking it back. */
export async function checkMySentence(sentenceId: number, checked: boolean): Promise<void> {
  await requireSession();
  const input = z.object({ id: z.int().positive(), checked: z.boolean() }).parse({ id: sentenceId, checked });
  await setChecked(getDb(), input.id, input.checked);
  refresh();
}

export async function saveNotes(itemId: number, notes: string): Promise<SaveResult> {
  await requireSession();
  const input = z.object({ itemId: z.int().positive(), notes: z.string().max(4000) }).safeParse({ itemId, notes });
  if (!input.success) return { error: "That's too long to save. Keep notes under 4,000 characters." };
  const result = await setNotes(getDb(), input.data.itemId, input.data.notes);
  refresh();
  return result;
}
