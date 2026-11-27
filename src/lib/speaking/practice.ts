/**
 * Speaking practice's data: the prompt of the day, the shadowing sets, and the minutes in-app
 * sessions log by themselves (F_Speaking, F_Shadowing).
 */
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import type { Level } from "@content/schema";
import type { DbOrTx } from "@/db/client";
import { activityLogs, prompts, shadowingSets } from "@/db/schema";
import { daysBetween, phaseFor, type PhaseStarts, type StudyDate } from "@/lib/day";

import { capMinutes } from "./minutes";

export type PromptOfTheDay = {
  id: number;
  /** The task, in English. */
  prompt: string;
  /** A short Japanese title, when the prompt has one (none do yet). */
  title?: string;
  /** Patterns to try, with ruby markup. */
  hints: string[];
  /** The model answer, with ruby markup. */
  model: string;
  modelEn: string;
};

/** Levels to pick prompts from in each phase, best first. */
const PROMPT_LEVELS: Record<string, Level[]> = {
  n5: ["N5"],
  n4: ["N4", "N5"],
  n3: ["N3", "N4", "N5"],
  work: ["N3", "N4", "N5"],
};

/** The rotation counts days from here, so each date always gets the same prompt. */
const ROTATION_START = "2026-01-01";

const promptFields = {
  id: prompts.id,
  level: prompts.level,
  prompt: prompts.prompt,
  hints: prompts.hints,
  model: prompts.model,
  modelEn: prompts.modelEn,
};

const toPrompt = (r: { id: number; prompt: string; hints: string[]; model: string; modelEn: string }): PromptOfTheDay => ({
  id: r.id,
  prompt: r.prompt,
  hints: r.hints,
  model: r.model,
  modelEn: r.modelEn,
});

/**
 * The date's prompt: at the current phase's level (N5 in the N5 phase, N4 from the N4 phase, with
 * N5 when a level has none), taking the next one each day in content order. null with no prompts.
 */
export async function promptOfTheDay(db: DbOrTx, date: StudyDate, settings: PhaseStarts): Promise<PromptOfTheDay | null> {
  const wanted = PROMPT_LEVELS[phaseFor(date, settings)?.id ?? "n5"];
  const rows = await db
    .select(promptFields)
    .from(prompts)
    .where(inArray(prompts.level, wanted))
    .orderBy(asc(prompts.id));
  const level = wanted.find((l) => rows.some((r) => r.level === l));
  const pool = rows.filter((r) => r.level === level);
  if (pool.length === 0) return null;
  const day = daysBetween(ROTATION_START, date);
  return toPrompt(pool[((day % pool.length) + pool.length) % pool.length]);
}

export async function getPrompt(db: DbOrTx, id: number): Promise<PromptOfTheDay | null> {
  const [row] = await db.select(promptFields).from(prompts).where(eq(prompts.id, id));
  return row ? toPrompt(row) : null;
}

export type ShadowingSet = { id: number; slug: string; level: Level; title: string; sentences: { ja: string; en: string }[] };

const setFields = {
  id: shadowingSets.id,
  slug: shadowingSets.seedSlug,
  level: shadowingSets.level,
  title: shadowingSets.title,
  sentences: shadowingSets.sentences,
};

const toSet = (r: { id: number; slug: string | null; level: Level; title: string; sentences: { ja: string; en: string }[] }): ShadowingSet => ({
  ...r,
  slug: r.slug ?? `shadow:${r.id}`,
});

/** Every shadowing set, in content order. */
export async function listShadowingSets(db: DbOrTx): Promise<ShadowingSet[]> {
  const rows = await db.select(setFields).from(shadowingSets).orderBy(asc(shadowingSets.id));
  return rows.map(toSet);
}

export async function getShadowingSet(db: DbOrTx, id: number): Promise<ShadowingSet | null> {
  const [row] = await db.select(setFields).from(shadowingSets).where(eq(shadowingSets.id, id));
  return row ? toSet(row) : null;
}

export type PracticeKind = "speaking" | "shadowing";

/** Logs a session's minutes (held to 1–30) as speaking practice the app logged by itself. */
export async function logPracticeMinutes(db: DbOrTx, input: { kind: PracticeKind; minutes: number; date: StudyDate }): Promise<number> {
  const minutes = capMinutes(input.minutes);
  await db.insert(activityLogs).values({ studyDate: input.date, kind: input.kind, skill: "speaking", minutes, auto: true });
  return minutes;
}

/** Minutes speaking and shadowing sessions logged by themselves on a date. */
export async function practiceMinutesOn(db: DbOrTx, date: StudyDate): Promise<{ speaking: number; shadowing: number; total: number }> {
  const rows = await db
    .select({ kind: activityLogs.kind, minutes: sql<number>`coalesce(sum(${activityLogs.minutes}), 0)::int` })
    .from(activityLogs)
    .where(and(eq(activityLogs.studyDate, date), eq(activityLogs.auto, true), inArray(activityLogs.kind, ["speaking", "shadowing"])))
    .groupBy(activityLogs.kind);
  const speaking = rows.find((r) => r.kind === "speaking")?.minutes ?? 0;
  const shadowing = rows.find((r) => r.kind === "shadowing")?.minutes ?? 0;
  return { speaking, shadowing, total: speaking + shadowing };
}
