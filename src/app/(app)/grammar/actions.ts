"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db/client";
import { items } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import { loadPoints, nextUnread, setGrammarStatus, type GrammarStatus } from "@/lib/learn/grammar";
import { saveOps } from "@/lib/srs/save";

const Mark = z.object({
  /** Made on the device, so pressing twice or a retry saves the verdict once. */
  opId: z.uuid(),
  itemId: z.int().positive(),
  choice: z.enum(["known", "learn"]),
  /** The lesson's check questions answered: true for right. */
  answers: z.array(z.boolean()).max(10),
});

export type MarkResult = { status: GrammarStatus; next: number | null } | { error: string };

/**
 * The end of a lesson (decision 6's read-through). "I know this" is a known quick-check verdict,
 * so the card starts with a long interval, unless a check question was missed: then it's
 * "Learn it", which puts the card first in line for new cards.
 */
export async function markLesson(input: z.input<typeof Mark>): Promise<MarkResult> {
  await requireSession();
  const parsed = Mark.safeParse(input);
  if (!parsed.success) return { error: "That didn't save. Reload the page and try again." };
  const { opId, itemId, choice, answers } = parsed.data;
  const db = getDb();
  const [item] = await db.select({ level: items.level, kind: items.kind }).from(items).where(eq(items.id, itemId));
  if (!item?.level || item.kind !== "grammar") return { error: "That grammar point isn't there any more." };

  const missed = answers.some((a) => !a);
  const known = choice === "known" && !missed;
  const [result] = await saveOps(db, [
    {
      kind: "check",
      id: opId,
      itemId,
      verdict: choice === "known" ? "known" : "unsure",
      verified: choice === "known" && answers.length > 0 ? !missed : null,
      checkedAt: new Date().toISOString(),
    },
  ]);
  if (!result || (result.status !== "saved" && result.status !== "duplicate")) return { error: "That didn't save. Try again." };
  const status: GrammarStatus = known ? "confident" : "learning";
  await setGrammarStatus(db, itemId, status);

  const next = nextUnread(await loadPoints(db, item.level), itemId);
  refresh();
  return { status, next: next?.id ?? null };
}

const Status = z.object({ itemId: z.int().positive(), status: z.enum(["not_started", "learning", "confident"]) });

/** The status chips on a lesson. */
export async function changeStatus(itemId: number, status: GrammarStatus): Promise<void> {
  await requireSession();
  const input = Status.parse({ itemId, status });
  await setGrammarStatus(getDb(), input.itemId, input.status);
  refresh();
}
