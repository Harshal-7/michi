"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db/client";
import { requireSession } from "@/lib/auth/session";
import { studyDate } from "@/lib/day";
import { logPracticeMinutes } from "@/lib/speaking/practice";

/** One finished session: the browser counts its minutes; the server holds them to 1–30 again. */
const PracticeMinutes = z.object({ kind: z.enum(["speaking", "shadowing"]), minutes: z.number().finite() });

export type LogResult = { minutes: number } | { error: string };

/** "Done" on Speaking and Shadowing: logs the session as speaking minutes, by itself. */
export async function logPractice(input: z.input<typeof PracticeMinutes>): Promise<LogResult> {
  await requireSession();
  const parsed = PracticeMinutes.safeParse(input);
  if (!parsed.success) return { error: "That didn't save. Reload the page and try again." };
  const minutes = await logPracticeMinutes(getDb(), { ...parsed.data, date: studyDate() });
  refresh();
  return { minutes };
}
