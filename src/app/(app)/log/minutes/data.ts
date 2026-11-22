/** Minutes logged by hand or by the app, in `activity_logs`. */
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";

import type { DbOrTx } from "@/db/client";
import { activityLogs } from "@/db/schema";
import { addDays, daysBetween, isStudyDate, type StudyDate } from "@/lib/day";

import { LOGGABLE_KINDS, SKILLS } from "./kinds";

/** How far back an entry can be dated. */
export const BACKDATE_DAYS = 6;

export const MinutesEntry = z.object({
  date: z.string().refine(isStudyDate, "Pick a day."),
  kind: z.enum(LOGGABLE_KINDS, "Pick what you did."),
  skill: z.enum(SKILLS, "Pick a skill."),
  minutes: z.coerce.number("Enter the minutes.").int("Whole minutes, please.").min(1, "At least 1 minute.").max(600, "At most 600 minutes."),
  note: z.string().trim().max(200, "Keep the note under 200 characters.").default(""),
});
export type MinutesEntry = z.infer<typeof MinutesEntry>;

/** Within the last week and not in the future. */
export function datable(date: StudyDate, today: StudyDate): boolean {
  const back = daysBetween(date, today);
  return back >= 0 && back <= BACKDATE_DAYS;
}

export async function addMinutesEntry(db: DbOrTx, entry: MinutesEntry) {
  const [row] = await db
    .insert(activityLogs)
    .values({ studyDate: entry.date, kind: entry.kind, skill: entry.skill, minutes: entry.minutes, note: entry.note })
    .returning({ id: activityLogs.id });
  return row.id;
}

export async function deleteMinutesEntry(db: DbOrTx, id: number) {
  await db.delete(activityLogs).where(eq(activityLogs.id, id));
}

export async function listMinutes(db: DbOrTx, from: StudyDate, to: StudyDate) {
  return db
    .select({
      id: activityLogs.id,
      date: activityLogs.studyDate,
      kind: activityLogs.kind,
      skill: activityLogs.skill,
      minutes: activityLogs.minutes,
      note: activityLogs.note,
      auto: activityLogs.auto,
      classLogId: activityLogs.classLogId,
    })
    .from(activityLogs)
    .where(and(gte(activityLogs.studyDate, from), lte(activityLogs.studyDate, to)))
    .orderBy(desc(activityLogs.studyDate), desc(activityLogs.id));
}

/** Today and the days before it that an entry can be dated. */
export function datableDays(today: StudyDate): StudyDate[] {
  return Array.from({ length: BACKDATE_DAYS + 1 }, (_, i) => addDays(today, -i));
}
