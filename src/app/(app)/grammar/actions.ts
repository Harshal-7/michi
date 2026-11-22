"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db/client";
import { requireSession } from "@/lib/auth/session";
import { type GrammarStatus, markLessonIn, setGrammarStatus } from "@/lib/learn/grammar";

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
