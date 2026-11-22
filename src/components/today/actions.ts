"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db/client";
import { taskOverrides } from "@/db/schema";
import { updateSettings } from "@/db/settings";
import { requireSession } from "@/lib/auth/session";
import { isStudyDate } from "@/lib/day";
import { loadPlan } from "@/lib/planner/store";

const Mark = z.object({
  date: z.string().refine(isStudyDate),
  key: z.string().min(1).max(100),
  mark: z.enum(["done", "skipped"]).nullable(),
});

/** Marks one of the day's tasks done or skipped by hand, or clears the mark (null). */
export async function markTask(date: string, key: string, mark: "done" | "skipped" | null): Promise<void> {
  await requireSession();
  const input = Mark.parse({ date, key, mark });
  const db = getDb();
  const plan = await loadPlan(db, input.date);
  if (!plan?.tasks.some((t) => t.key === input.key)) throw new Error("That task isn't on the day's list any more. Reload the page.");
  if (input.mark === null) {
    await db.delete(taskOverrides).where(and(eq(taskOverrides.studyDate, input.date), eq(taskOverrides.taskKey, input.key)));
  } else {
    await db
      .insert(taskOverrides)
      .values({ studyDate: input.date, taskKey: input.key, mark: input.mark })
      .onConflictDoUpdate({ target: [taskOverrides.studyDate, taskOverrides.taskKey], set: { mark: input.mark } });
  }
  refresh();
}

/** Puts the registration card away. */
export async function markRegistered(level: "N4" | "N3"): Promise<void> {
  await requireSession();
  const which = z.enum(["N4", "N3"]).parse(level);
  await updateSettings(getDb(), { registration: { [which]: { registered: true } } });
  refresh();
}
