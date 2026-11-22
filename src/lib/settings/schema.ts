/**
 * The one settings row: dates, classes, budgets, FSRS, voice, furigana, theme and reminder.
 * Phases, exam dates and class days come from here, never from code. The Settings page that
 * edits them is round 1.
 */
import { z } from "zod";

import { daysBetween, isStudyDate, PHASE_IDS } from "@/lib/day";
import { THEMES } from "@/lib/theme";

const date = z.string().refine(isStudyDate, "a date written YYYY-MM-DD");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "a time written HH:MM");
const minutes = z.int().min(0).max(24 * 60);
const hours = z.number().min(0).max(1000);

const phaseStart = z.object({ start: date });
const exam = z.object({
  date,
  /** False until JLPT publishes the date; the app shows "expected". */
  confirmed: z.boolean(),
});
const practiceTarget = z.object({ listeningHours: hours, speakingHours: hours });

export const SettingsShape = z.object({
  /** Each phase runs until the next one starts (src/lib/day.ts phaseFor). */
  phases: z.object({ n5: phaseStart, n4: phaseStart, n3: phaseStart, work: phaseStart }),
  exams: z.object({ N4: exam, N3: exam }),
  registration: z.object({
    /** When the "register for the exam" card starts showing; `registered` puts it away. */
    N4: z.object({ remindOn: date, registered: z.boolean() }),
    N3: z.object({ remindOn: date, registered: z.boolean() }),
    /** Your city's JLPT host, picked in Settings. */
    hostUrl: z.url().nullable(),
  }),
  /** The date each level's lists should be finished by (the pace aims for it). */
  listDeadlines: z.object({ N5: date, N4: date, N3: date }),
  /** N3 lists start at a light pace from here, while N4 is on track. */
  n3EarlyStart: date,
  /** Work Japanese unlocks on this date. */
  workUnlock: date,
  classes: z.object({
    /** 0 Sunday … 6 Saturday. */
    days: z.array(z.int().min(0).max(6)).max(7),
    startsOn: date,
    minutes,
  }),
  budgets: z.object({ weekdayMinutes: minutes, weekendMinutes: minutes }),
  fsrs: z.object({
    targetRecall: z.number().min(0.7).max(0.99),
    /** ts-fsrs steps: "1m", "10m", "1h", "1d". */
    learningSteps: z
      .array(z.string().regex(/^\d+[smhd]$/))
      .min(1)
      .max(10),
  }),
  /** Listening and speaking hours outside class, per phase. */
  practiceTargets: z.object({ n5: practiceTarget, n4: practiceTarget, n3: practiceTarget }),
  voice: z.object({ name: z.string().nullable(), rate: z.number().min(0.5).max(1.5) }),
  speechRecognition: z.boolean(),
  /** Furigana over kanji above your level; off hides it everywhere. */
  furigana: z.boolean(),
  /**
   * The default theme. Each device keeps its own choice (src/lib/theme.ts), which wins; this is
   * for the backup and a device that hasn't picked.
   */
  theme: z.enum(THEMES),
  /** The evening reminder (round 4), sent only if Reviews or the Daily quiz are still open. */
  reminder: z.object({ enabled: z.boolean(), time }),
});
export type Settings = z.infer<typeof SettingsShape>;

/** Checks that the dates agree with each other; used when saving. */
export const SettingsSchema = SettingsShape.superRefine((s, ctx) => {
  for (let i = 1; i < PHASE_IDS.length; i++) {
    const [prev, next] = [PHASE_IDS[i - 1], PHASE_IDS[i]];
    if (daysBetween(s.phases[prev].start, s.phases[next].start) <= 0) {
      ctx.addIssue({ code: "custom", path: ["phases", next, "start"], message: `starts after the ${prev} phase` });
    }
  }
  if (daysBetween(s.exams.N4.date, s.exams.N3.date) <= 0) {
    ctx.addIssue({ code: "custom", path: ["exams", "N3", "date"], message: "comes after the N4 exam" });
  }
  if (new Set(s.classes.days).size !== s.classes.days.length) {
    ctx.addIssue({ code: "custom", path: ["classes", "days"], message: "lists each day once" });
  }
});

export const DEFAULT_SETTINGS: Settings = {
  phases: {
    n5: { start: "2026-11-21" },
    n4: { start: "2027-01-01" },
    n3: { start: "2027-07-05" },
    work: { start: "2027-12-06" },
  },
  exams: {
    N4: { date: "2027-07-04", confirmed: false },
    N3: { date: "2027-12-05", confirmed: false },
  },
  registration: {
    N4: { remindOn: "2027-03-01", registered: false },
    N3: { remindOn: "2027-08-01", registered: false },
    hostUrl: null,
  },
  listDeadlines: { N5: "2026-12-26", N4: "2027-06-12", N3: "2027-11-13" },
  n3EarlyStart: "2027-04-01",
  workUnlock: "2027-01-01",
  classes: { days: [6, 0], startsOn: "2027-01-02", minutes: 120 },
  budgets: { weekdayMinutes: 75, weekendMinutes: 210 },
  fsrs: { targetRecall: 0.9, learningSteps: ["1m", "10m"] },
  practiceTargets: {
    n5: { listeningHours: 12, speakingHours: 6 },
    n4: { listeningHours: 55, speakingHours: 30 },
    n3: { listeningHours: 50, speakingHours: 25 },
  },
  voice: { name: null, rate: 1 },
  speechRecognition: true,
  furigana: true,
  theme: "system",
  reminder: { enabled: true, time: "20:30" },
};

export type SettingsPatch = DeepPartial<Settings>;
type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** `patch` laid over `base`: objects merge key by key, anything else (arrays too) replaces. */
export function mergeSettings<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return (patch === undefined ? base : patch) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined && key in base) out[key] = mergeSettings(base[key as keyof typeof base], value);
  }
  return out as T;
}

/**
 * Settings as stored, made whole: fields added since the row was saved take their defaults,
 * and a section that doesn't check out falls back to its default rather than breaking the app.
 */
export function parseStoredSettings(stored: unknown): Settings {
  const merged = mergeSettings(DEFAULT_SETTINGS, isPlainObject(stored) ? stored : {}) as Record<string, unknown>;
  const out = {} as Record<string, unknown>;
  for (const [key, schema] of Object.entries(SettingsShape.shape)) {
    const parsed = (schema as z.ZodType).safeParse(merged[key]);
    out[key] = parsed.success ? parsed.data : DEFAULT_SETTINGS[key as keyof Settings];
  }
  return out as Settings;
}
