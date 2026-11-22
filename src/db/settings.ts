/** Reads and saves the settings row and the calendar overrides. */
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";

import { isStudyDate, type StudyDate } from "@/lib/day";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  parseStoredSettings,
  type Settings,
  SettingsSchema,
  type SettingsPatch,
} from "@/lib/settings/schema";

import type { DbOrTx } from "./client";
import { calendarOverrides, overrideKind, settings } from "./schema";

/** The settings, or the defaults if nothing has been saved yet. */
export async function getSettings(db: DbOrTx): Promise<Settings> {
  const [row] = await db.select({ data: settings.data }).from(settings).where(eq(settings.id, 1));
  return row ? parseStoredSettings(row.data) : structuredClone(DEFAULT_SETTINGS);
}

export class SettingsError extends Error {
  constructor(public readonly issues: z.core.$ZodIssue[]) {
    super(`Settings don't check out: ${issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  }
}

/**
 * Lays `patch` over the saved settings, checks the result and saves it. The row is locked
 * while this runs, so two devices saving at once don't lose each other's changes.
 */
export async function updateSettings(db: DbOrTx, patch: SettingsPatch): Promise<Settings> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ data: settings.data }).from(settings).where(eq(settings.id, 1)).for("update");
    const current = row ? parseStoredSettings(row.data) : structuredClone(DEFAULT_SETTINGS);
    const parsed = SettingsSchema.safeParse(mergeSettings(current, patch));
    if (!parsed.success) throw new SettingsError(parsed.error.issues);
    await tx
      .insert(settings)
      .values({ id: 1, data: parsed.data })
      .onConflictDoUpdate({ target: settings.id, set: { data: parsed.data, updatedAt: new Date() } });
    return parsed.data;
  });
}

// ---------------------------------------------------------------------------
// Calendar overrides

export const CalendarOverride = z.object({
  date: z.string().refine(isStudyDate, "a date written YYYY-MM-DD"),
  kind: z.enum(overrideKind.enumValues),
  note: z.string().trim().max(200).default(""),
});
export type CalendarOverride = z.infer<typeof CalendarOverride>;

/** Overrides from `from` to `to`, both included, in date order. */
export async function listOverrides(db: DbOrTx, from: StudyDate, to: StudyDate): Promise<CalendarOverride[]> {
  return db
    .select({ date: calendarOverrides.date, kind: calendarOverrides.kind, note: calendarOverrides.note })
    .from(calendarOverrides)
    .where(and(gte(calendarOverrides.date, from), lte(calendarOverrides.date, to)))
    .orderBy(asc(calendarOverrides.date));
}

/** Sets the one override for a date, replacing any other. */
export async function setOverride(db: DbOrTx, input: z.input<typeof CalendarOverride>): Promise<CalendarOverride> {
  const value = CalendarOverride.parse(input);
  await db
    .insert(calendarOverrides)
    .values(value)
    .onConflictDoUpdate({
      target: calendarOverrides.date,
      set: { kind: value.kind, note: value.note, updatedAt: new Date() },
    });
  return value;
}

export async function clearOverride(db: DbOrTx, date: StudyDate): Promise<void> {
  await db.delete(calendarOverrides).where(eq(calendarOverrides.date, date));
}
