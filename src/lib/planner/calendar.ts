/**
 * What kind of day a date is, from the settings and the calendar exceptions: exam days, exam
 * prep, class days, mock-test days and each day's pace weight. Pure; dates come from src/lib/day.ts.
 */
import { addDays, daysBetween, isWeekend, phaseFor, type StudyDate, weekday } from "@/lib/day";
import type { Settings } from "@/lib/settings/schema";

export type OverrideKind = "rest" | "no_class" | "exam";
export type CalendarException = { date: StudyDate; kind: OverrideKind };

export type ExamLevel = "N4" | "N3";
export const EXAM_LEVELS: readonly ExamLevel[] = ["N4", "N3"];
export type MockLevel = "N5" | ExamLevel;

/** Exam prep is the last 3 weeks before each exam (decision 10): from 13 Jun for a 4 Jul exam. */
export const EXAM_PREP_DAYS = 21;
/** Mock tests start this many months before each exam: March for July, August for December. */
const MOCK_MONTHS_BEFORE = 4;
export const MOCK_MINUTES: Record<MockLevel, number> = { N5: 60, N4: 80, N3: 100 };

/** Pace weights (the plan's "Pace"): a gentler weekend, nothing on exam-prep, rest and exam days. */
export const WEEKDAY_WEIGHT = 1;
export const WEEKEND_WEIGHT = 1.2;

export type Calendar = {
  settings: Settings;
  overrides: ReadonlyMap<StudyDate, OverrideKind>;
  /** Pace weights and sums of them already worked out. */
  weights: Map<StudyDate, number>;
  sums: Map<string, number>;
};

export function makeCalendar(settings: Settings, exceptions: readonly CalendarException[]): Calendar {
  return { settings, overrides: new Map(exceptions.map((e) => [e.date, e.kind])), weights: new Map(), sums: new Map() };
}

/** The JLPT exam on this date; "other" for an exam day set as an exception. */
export function examOn(cal: Calendar, date: StudyDate): ExamLevel | "other" | null {
  for (const level of EXAM_LEVELS) if (cal.settings.exams[level].date === date) return level;
  return cal.overrides.get(date) === "exam" ? "other" : null;
}

/** The exam this date is preparing for: one of the 21 days before it. */
export function examPrepFor(cal: Calendar, date: StudyDate): ExamLevel | null {
  for (const level of EXAM_LEVELS) {
    const days = daysBetween(date, cal.settings.exams[level].date);
    if (days >= 1 && days <= EXAM_PREP_DAYS) return level;
  }
  return null;
}

/** "The Saturday before is light": the day before a JLPT exam. */
export function isDayBeforeExam(cal: Calendar, date: StudyDate): boolean {
  return EXAM_LEVELS.some((level) => daysBetween(date, cal.settings.exams[level].date) === 1);
}

export function isRestDay(cal: Calendar, date: StudyDate): boolean {
  return cal.overrides.get(date) === "rest";
}

/** A class day: one of the class weekdays, once classes have started, unless it's off or an exam. */
export function isClassDay(cal: Calendar, date: StudyDate): boolean {
  const { classes } = cal.settings;
  return (
    classes.days.includes(weekday(date)) &&
    daysBetween(classes.startsOn, date) >= 0 &&
    cal.overrides.get(date) !== "no_class" &&
    examOn(cal, date) === null
  );
}

/** How much of a list's remaining items this date should take (0 means none). */
export function paceWeight(cal: Calendar, date: StudyDate): number {
  const known = cal.weights.get(date);
  if (known !== undefined) return known;
  const weight =
    examOn(cal, date) || examPrepFor(cal, date) || isRestDay(cal, date)
      ? 0
      : isWeekend(date)
        ? WEEKEND_WEIGHT
        : WEEKDAY_WEIGHT;
  cal.weights.set(date, weight);
  return weight;
}

/** The sum of the pace weights from `from` to `to`, both included (0 when `to` is before `from`). */
export function weightBetween(cal: Calendar, from: StudyDate, to: StudyDate): number {
  const key = `${from}|${to}`;
  const known = cal.sums.get(key);
  if (known !== undefined) return known;
  let sum = 0;
  const days = daysBetween(from, to);
  for (let i = 0; i <= days; i++) sum += paceWeight(cal, addDays(from, i));
  cal.sums.set(key, sum);
  return sum;
}

const monthIndex = (date: StudyDate) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;

/**
 * The mock test on a date, if any (decision 14):
 * - N5 on the Saturday on or after the N5 lists' deadline, while the N5 refresh runs;
 * - N4 and N3 on the first Saturday of each month from four months before the exam, and every
 *   Saturday of exam prep except the day before the exam.
 */
export function mockOn(cal: Calendar, date: StudyDate): MockLevel | null {
  if (weekday(date) !== 6 || examOn(cal, date)) return null;
  const n5Deadline = cal.settings.listDeadlines.N5;
  const n5Saturday = addDays(n5Deadline, (6 - weekday(n5Deadline) + 7) % 7);
  if (date === n5Saturday && phaseFor(date, cal.settings)?.id === "n5") return "N5";
  for (const level of EXAM_LEVELS) {
    const exam = cal.settings.exams[level].date;
    const days = daysBetween(date, exam);
    if (days <= 1) continue;
    if (days <= EXAM_PREP_DAYS) return level;
    const firstSaturday = Number(date.slice(8, 10)) <= 7;
    if (firstSaturday && monthIndex(date) >= monthIndex(exam) - MOCK_MONTHS_BEFORE) return level;
  }
  return null;
}

export type UpcomingExam = { level: ExamLevel; date: StudyDate; confirmed: boolean; days: number };

/** The next JLPT exam on or after `date`. */
export function nextExam(cal: Calendar, date: StudyDate): UpcomingExam | null {
  for (const level of EXAM_LEVELS) {
    const exam = cal.settings.exams[level];
    const days = daysBetween(date, exam.date);
    if (days >= 0) return { level, date: exam.date, confirmed: exam.confirmed, days };
  }
  return null;
}
