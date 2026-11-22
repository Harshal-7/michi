"use server";

import { refresh } from "next/cache";

import { getDb } from "@/db/client";
import { CalendarOverride, clearOverride, SettingsError, setOverride, updateSettings } from "@/db/settings";
import { requireSession } from "@/lib/auth/session";
import { isStudyDate, studyDate } from "@/lib/day";
import { rebuildDayPlan } from "@/lib/planner/freeze";
import type { SettingsPatch } from "@/lib/settings/schema";

export type SaveResult = { ok: true } | { ok: false; error: string };

const FIELD_NAMES: Record<string, string> = {
  "phases.n4.start": "N4 build",
  "phases.n3.start": "N3 build",
  "phases.work.start": "Work Japanese phase",
  "exams.N3.date": "JLPT N3",
  "classes.days": "Class days",
  "registration.hostUrl": "Host link",
  "reminder.time": "Reminder time",
};

function explain(error: unknown): string {
  if (error instanceof SettingsError) {
    return error.issues
      .map((i) => {
        const path = i.path.join(".");
        return `${FIELD_NAMES[path] ?? path}: ${i.message}.`;
      })
      .join(" ");
  }
  throw error;
}

/** Today's plan follows any change to the settings or the calendar. */
async function afterChange() {
  await rebuildDayPlan(getDb(), studyDate());
  refresh();
}

/** Saves part of the settings (checked whole before saving) and rebuilds today's plan. */
export async function saveSettings(patch: SettingsPatch): Promise<SaveResult> {
  await requireSession();
  try {
    await updateSettings(getDb(), patch);
  } catch (error) {
    return { ok: false, error: explain(error) };
  }
  await afterChange();
  return { ok: true };
}

/** Sets a rest day, a day without class or an exam day. */
export async function saveException(input: { date: string; kind: string; note: string }): Promise<SaveResult> {
  await requireSession();
  const parsed = CalendarOverride.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick a date and what kind of day it is." };
  await setOverride(getDb(), parsed.data);
  await afterChange();
  return { ok: true };
}

export async function removeException(date: string): Promise<SaveResult> {
  await requireSession();
  if (!isStudyDate(date)) return { ok: false, error: "That isn't a date." };
  await clearOverride(getDb(), date);
  await afterChange();
  return { ok: true };
}
