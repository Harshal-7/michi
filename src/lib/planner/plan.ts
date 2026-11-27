/**
 * The planner: today's tasks from the date, the settings, the calendar, the reviews due, each
 * list's pace and the quick check (the plan's "The study engine"). Pure and tested; store.ts
 * gathers its input and freeze.ts stores the result once per study day.
 *
 * Order of filling:
 * 1. Fixed blocks: class and logging it, the quick check, the quiz and tests, a mock (which
 *    takes the quiz's place), and at least 10 minutes of speaking.
 * 2. Reviews, up to 55% of the free time.
 * 3. New items from the pace, scaled down if they don't fit the time left.
 * 4. The rest (the N5 grammar read-through while it lasts, then grammar, more speaking, Work
 *    Japanese, reading, listening), each up to its usual
 *    minutes from the "Typical days" table while time lasts. Immersion goes last, so it's the
 *    first to be trimmed.
 *
 * Only must-do tasks can take a day over its budget (a mock on a class day does); everything
 * optional is trimmed to fit. Only tasks whose screens exist are planned: AVAILABLE_TASK_KINDS
 * grows each round.
 */
import { daysBetween, isWeekend, phaseFor, type StudyDate, weekday, weekOf } from "@/lib/day";
import type { Settings } from "@/lib/settings/schema";

import {
  type Calendar,
  type CalendarException,
  examOn,
  examPrepFor,
  isClassDay,
  isDayBeforeExam,
  isRestDay,
  makeCalendar,
  MOCK_MINUTES,
  mockOn,
} from "./calendar";
import { type DayMode, DayPlan, type DayTask, ROUTES, type TaskKind } from "./day-plan";
import { type DeckQuota, type DeckState, minutesFor, paceQuotas, scaleToMinutes } from "./pace";

/**
 * Round 1 has Reviews, the quick check, New items, and listening, speaking and reading logged
 * in the minutes log; round 1.5 the grammar read-through; round 2 the daily quiz, the weekly test
 * and the speaking screen. The daily Grammar task stays off: N5 grammar cards come with New items.
 * Round 3 adds the class and its log; round 4 mocks and Work Japanese.
 */
export const AVAILABLE_TASK_KINDS: readonly TaskKind[] = [
  "reviews",
  "quick_check",
  "read_through",
  "new_items",
  "daily_quiz",
  "weekly_test",
  "speaking",
  "listening",
  "reading",
];

/** The order tasks are listed in. */
export const DISPLAY_ORDER: readonly TaskKind[] = [
  "class",
  "log_class",
  "quick_check",
  "reviews",
  "new_items",
  "read_through",
  "grammar",
  "daily_quiz",
  "weekly_test",
  "mock",
  "speaking",
  "work",
  "reading",
  "listening",
];

/** About 8 seconds a card: 64 cards is about 9 minutes. */
export const REVIEW_SECONDS = 8;
/** Reviews take at most this share of the time left after the fixed blocks. */
export const REVIEW_SHARE = 0.55;
/** Recovery when reviews due are more than this many times a normal day's. */
export const RECOVERY_FACTOR = 1.5;
/** Re-entry after this many days away or more. */
export const RE_ENTRY_DAYS_AWAY = 3;
/** A rest day: learning cards and a few reviews only. */
export const REST_DAY_MINUTES = 15;
export const REST_DAY_REVIEWS = 20;
/** Always plan at least this many reviews when any are due, however full the day. */
export const MIN_REVIEWS = 15;
/** An optional task shorter than this isn't worth listing. */
export const MIN_OPTIONAL_MINUTES = 5;
export const SPEAKING_MIN = 10;
export const LOG_CLASS_MINUTES = 10;
export const QUIZ_MINUTES = 6;
export const SECTION_DRILL_MINUTES = 15;
export const WEEKLY_TEST_MINUTES = 20;
export const WORK_MINUTES = 20;
export const N3_WEEKDAY_READING = 10;
/** Exam prep has more listening. */
export const EXAM_PREP_LISTENING = 1.5;
/** The quick check is spread over the first 3 days, kana first. */
export const QUICK_CHECK_DAYS = 3;
export const QUICK_CHECK_SECONDS = { kana: 2, other: 4.5 };
/** The N5 grammar read-through: about 1.5 minutes a lesson, spread over 7 days from the first. */
export const READ_THROUGH_DAYS = 7;
export const READ_THROUGH_MINUTES = 1.5;
/** Past its 7 days, what's left still comes at most this many a day. */
export const READ_THROUGH_MAX = 30;
export const READ_THROUGH_KEY = "read_through";

export type DayType = "weekday" | "weekend" | "class_weekend";

/** The "Typical days" table: usual minutes for the tasks that fill the rest of the day. */
export const TYPICAL: Record<DayType, { reviews: number; grammar: number; speaking: number; listening: number; reading: number }> = {
  weekday: { reviews: 20, grammar: 10, speaking: 10, listening: 15, reading: 0 },
  weekend: { reviews: 25, grammar: 30, speaking: 25, listening: 45, reading: 20 },
  class_weekend: { reviews: 20, grammar: 10, speaking: 15, listening: 20, reading: 0 },
};

export type PlanInput = {
  date: StudyDate;
  settings: Settings;
  /** Calendar exceptions; future ones matter too, for the pace weights. */
  exceptions: readonly CalendarException[];
  /** Cards due today as of the start of the day (reviewed ones included), and the learning ones among them. */
  reviews: { due: number; learningDue: number };
  /** The last day before today with any reviews or logged minutes. */
  lastActiveDate: StudyDate | null;
  decks: readonly DeckState[];
  /** Items the quick check has left at the start of the day, and the day it started. */
  quickCheck: { remainingKana: number; remainingOther: number; startedOn: StudyDate | null };
  /** N5 grammar lessons the read-through has left at the start of the day, and its first day. None when left out. */
  readThrough?: { remaining: number; startedOn: StudyDate | null };
  /** Unfinished tasks from yesterday that carry over (logging a class, the weekly test). */
  carryOver?: readonly DayTask[];
  /** Which task kinds have screens; AVAILABLE_TASK_KINDS unless a test says otherwise. */
  available?: readonly TaskKind[];
};

export type PlanDetail = { plan: DayPlan; mode: DayMode; quotas: DeckQuota[]; calendar: Calendar };

export function reviewMinutes(cards: number): number {
  return cards > 0 ? Math.max(1, Math.ceil((cards * REVIEW_SECONDS) / 60)) : 0;
}

export function cardsInMinutes(minutes: number): number {
  return Math.floor((Math.max(0, minutes) * 60) / REVIEW_SECONDS);
}

export function dayTypeOf(cal: Calendar, date: StudyDate): DayType {
  if (!isWeekend(date)) return "weekday";
  return isClassDay(cal, date) ? "class_weekend" : "weekend";
}

/** A normal day's reviews: as many cards as fit in the usual review time for this kind of day. */
export function normalReviews(dayType: DayType): number {
  return cardsInMinutes(TYPICAL[dayType].reviews);
}

/** Day modes, first match wins: exam day, exam prep, recovery, re-entry, rest, normal. */
export function dayModeFor(input: PlanInput, cal: Calendar): DayMode {
  const { date } = input;
  if (examOn(cal, date)) return "exam_day";
  if (examPrepFor(cal, date)) return "exam_prep";
  if (input.reviews.due > RECOVERY_FACTOR * normalReviews(dayTypeOf(cal, date))) return "recovery";
  if (input.lastActiveDate && daysBetween(input.lastActiveDate, date) - 1 >= RE_ENTRY_DAYS_AWAY) return "re_entry";
  if (isRestDay(cal, date)) return "rest";
  return "normal";
}

const task = (t: Omit<DayTask, "must"> & { must?: boolean }): DayTask => ({ must: false, ...t });

const byDisplayOrder = (a: DayTask, b: DayTask) => DISPLAY_ORDER.indexOf(a.kind) - DISPLAY_ORDER.indexOf(b.kind);

/** Listening and reading are logged in the minutes log until their own screens arrive. */
const minutesHref = (kind: "listening" | "reading") => `${ROUTES.minutes}?kind=${kind}`;

/** Today's quick-check target: what's left spread over the days left of its first 3, kana first. */
export function quickCheckPlan(
  quickCheck: PlanInput["quickCheck"],
  date: StudyDate,
): { target: number; minutes: number } | null {
  const remaining = quickCheck.remainingKana + quickCheck.remainingOther;
  if (remaining <= 0) return null;
  const daysIn = quickCheck.startedOn ? daysBetween(quickCheck.startedOn, date) : 0;
  const daysLeft = Math.max(1, QUICK_CHECK_DAYS - daysIn);
  const target = Math.ceil(remaining / daysLeft);
  const kana = Math.min(target, quickCheck.remainingKana);
  const seconds = kana * QUICK_CHECK_SECONDS.kana + (target - kana) * QUICK_CHECK_SECONDS.other;
  return { target, minutes: Math.max(1, Math.ceil(seconds / 60)) };
}

/** Today's share of the grammar read-through: what's left over the days left of its first 7. */
export function readThroughPlan(
  readThrough: PlanInput["readThrough"],
  date: StudyDate,
): { target: number; minutes: number } | null {
  const remaining = readThrough?.remaining ?? 0;
  if (remaining <= 0) return null;
  const daysIn = readThrough?.startedOn ? daysBetween(readThrough.startedOn, date) : 0;
  const daysLeft = Math.max(1, READ_THROUGH_DAYS - daysIn);
  const target = Math.min(READ_THROUGH_MAX, Math.ceil(remaining / daysLeft));
  return { target, minutes: Math.ceil(target * READ_THROUGH_MINUTES) };
}

export function plan(input: PlanInput): DayPlan {
  return planDetail(input).plan;
}

export function planDetail(input: PlanInput): PlanDetail {
  const { date, settings } = input;
  const cal = makeCalendar(settings, input.exceptions);
  const available = new Set(input.available ?? AVAILABLE_TASK_KINDS);
  const has = (kind: TaskKind) => available.has(kind);
  const mode = dayModeFor(input, cal);
  const weekend = isWeekend(date);
  const fullBudget = weekend ? settings.budgets.weekendMinutes : settings.budgets.weekdayMinutes;
  const done = (budgetMinutes: number, tasks: DayTask[], quotas: DeckQuota[] = [], newQuota = {}, qc = 0): PlanDetail => ({
    plan: DayPlan.parse({
      version: 1,
      date,
      mode,
      budgetMinutes,
      tasks: tasks.sort(byDisplayOrder),
      newQuota,
      quickCheckTarget: qc,
    }),
    mode,
    quotas,
    calendar: cal,
  });

  // Exam day: the exam is the only thing on, and it has no screen.
  if (mode === "exam_day") return done(0, []);

  const { due, learningDue } = input.reviews;

  // Rest day: learning cards and a few reviews.
  if (mode === "rest") {
    const target = Math.min(due, learningDue + REST_DAY_REVIEWS);
    const budget = Math.min(fullBudget, REST_DAY_MINUTES);
    return done(budget, [reviewsTask(target, Math.min(reviewMinutes(target), budget))]);
  }

  const budget = isDayBeforeExam(cal, date) ? Math.round(fullBudget / 2) : fullBudget;
  const dayType = dayTypeOf(cal, date);
  const typical = TYPICAL[dayType];
  const prep = mode === "exam_prep";
  const mock = mockOn(cal, date);
  const tasks: DayTask[] = [];

  // 1. Fixed blocks.
  if (isClassDay(cal, date)) {
    if (has("class")) {
      tasks.push(task({ key: `class:${date}`, kind: "class", title: "Class", minutes: settings.classes.minutes, must: true, href: ROUTES.log }));
    }
    if (has("log_class")) {
      tasks.push(
        task({ key: `log_class:${date}`, kind: "log_class", title: "Log today's class", minutes: LOG_CLASS_MINUTES, must: true, href: ROUTES.log }),
      );
    }
  }
  for (const carried of input.carryOver ?? []) {
    if (has(carried.kind) && !tasks.some((t) => t.key === carried.key)) tasks.push(carried);
  }
  const qc = has("quick_check") ? quickCheckPlan(input.quickCheck, date) : null;
  if (qc) {
    tasks.push(task({ key: "quick_check", kind: "quick_check", title: "Quick check", minutes: qc.minutes, must: true, target: qc.target, href: ROUTES.quickCheck }));
  }
  // A mock is that day's test: it takes the daily quiz's place.
  const mockToday = mock !== null && has("mock");
  if (has("daily_quiz") && !mockToday) {
    tasks.push(
      prep && !weekend
        ? task({ key: "daily_quiz", kind: "daily_quiz", title: "Section drill", minutes: SECTION_DRILL_MINUTES, must: true, href: ROUTES.quiz })
        : task({ key: "daily_quiz", kind: "daily_quiz", title: "Daily quiz", minutes: QUIZ_MINUTES, must: true, href: ROUTES.quiz }),
    );
  }
  if (weekday(date) === 0 && has("weekly_test")) {
    const key = `weekly_test:${weekOf(date).start}`;
    if (!tasks.some((t) => t.key === key)) {
      tasks.push(task({ key, kind: "weekly_test", title: "Weekly test", minutes: WEEKLY_TEST_MINUTES, must: true, href: ROUTES.weeklyTest }));
    }
  }
  if (mock && mockToday) {
    tasks.push(
      task({ key: `mock:${mock}`, kind: "mock", title: `${mock} mock test`, minutes: MOCK_MINUTES[mock], must: true, href: ROUTES.practice }),
    );
  }
  const speaking = has("speaking")
    ? task({ key: "speaking", kind: "speaking", title: "Speaking", minutes: SPEAKING_MIN, href: ROUTES.speaking })
    : null;
  const fixed = tasks.reduce((s, t) => s + t.minutes, 0);
  if (speaking && fixed + speaking.minutes <= budget) tasks.push(speaking);
  const speakingPlanned = speaking !== null && tasks.includes(speaking);
  let left = Math.max(0, budget - fixed - (speakingPlanned ? SPEAKING_MIN : 0));

  // 2. Reviews, up to 55% of the free time; re-entry caps them at a normal day's.
  const cap = Math.floor(REVIEW_SHARE * left);
  let target = reviewMinutes(due) <= cap ? due : cardsInMinutes(cap);
  if (mode === "re_entry") target = Math.min(target, normalReviews(dayType));
  if (due > 0) target = Math.max(target, Math.min(due, MIN_REVIEWS));
  const reviews = reviewsTask(target, reviewMinutes(target));
  tasks.push(reviews);
  left = Math.max(0, left - reviews.minutes);

  // 3. New items. Grammar points get their own task once the grammar screen exists.
  const quotas = paceQuotas({
    cal,
    date,
    decks: input.decks,
    quickCheckDone: input.quickCheck.remainingKana + input.quickCheck.remainingOther === 0,
    readThroughDone: (input.readThrough?.remaining ?? 0) === 0,
    newItemsAllowed: mode === "normal",
  });
  const grammarApart = has("grammar");
  const isGrammar = (q: DeckQuota) => q.deck.kind === "grammar";
  const newOnes = has("new_items") ? quotas.filter((q) => q.quota > 0 && !(grammarApart && isGrammar(q))) : [];
  const scaled = scaleToMinutes(newOnes, left);
  const newQuota: Record<string, number> = {};
  for (const q of scaled) if (q.scaled > 0) newQuota[String(q.deck.id)] = q.scaled;
  const newTarget = scaled.reduce((s, q) => s + q.scaled, 0);
  if (newTarget > 0) {
    const minutes = minutesFor(scaled.map((q) => ({ kind: q.deck.kind, quota: q.scaled })));
    tasks.push(task({ key: "new_items", kind: "new_items", title: "New items", minutes, target: newTarget, href: ROUTES.newItems }));
    left = Math.max(0, left - minutes);
  }

  // 4. The rest, immersion last.
  const fill = (want: number, add: (minutes: number) => void) => {
    const minutes = Math.min(Math.round(want), left);
    if (minutes <= 0 || (minutes < MIN_OPTIONAL_MINUTES && minutes < want)) return;
    add(minutes);
    left -= minutes;
  };
  // The grammar read-through comes with the quick check, first of the rest: it stands in for
  // N5 grammar's new items until every lesson is read. Short of time, it's fewer lessons.
  const rt = has("read_through") ? readThroughPlan(input.readThrough, date) : null;
  if (rt) {
    fill(rt.minutes, (minutes) => {
      const target = minutes >= rt.minutes ? rt.target : Math.max(1, Math.floor(minutes / READ_THROUGH_MINUTES));
      tasks.push(task({ key: READ_THROUGH_KEY, kind: "read_through", title: "Read N5 grammar", minutes, target, href: ROUTES.nextLesson }));
    });
  }
  const grammar = grammarApart ? quotas.filter((q) => q.quota > 0 && isGrammar(q)) : [];
  if (grammar.length > 0) {
    fill(typical.grammar, (minutes) => {
      const points = grammar.reduce((s, q) => s + q.quota, 0);
      for (const q of grammar) newQuota[String(q.deck.id)] = q.quota;
      tasks.push(task({ key: "grammar", kind: "grammar", title: "Grammar", minutes, target: points, href: ROUTES.grammar }));
    });
  }
  if (speaking && speakingPlanned) fill(typical.speaking - SPEAKING_MIN, (minutes) => (speaking.minutes += minutes));
  if (weekday(date) === 6 && has("work") && !mock && daysBetween(settings.workUnlock, date) >= 0) {
    fill(WORK_MINUTES, (minutes) => tasks.push(task({ key: "work", kind: "work", title: "Work Japanese", minutes, href: "/work" })));
  }
  const n3Weekday = !weekend && phaseFor(date, settings)?.id === "n3";
  const reading = n3Weekday ? N3_WEEKDAY_READING : typical.reading;
  if (has("reading") && reading > 0) {
    fill(reading, (minutes) => tasks.push(task({ key: "reading", kind: "reading", title: "Reading", minutes, href: minutesHref("reading") })));
  }
  if (has("listening") && !mock) {
    fill(typical.listening * (prep ? EXAM_PREP_LISTENING : 1), (minutes) =>
      tasks.push(task({ key: "listening", kind: "listening", title: "Listening", minutes, href: minutesHref("listening") })),
    );
  }

  return done(budget, tasks, quotas, newQuota, qc?.target ?? 0);
}

function reviewsTask(target: number, minutes: number): DayTask {
  return task({ key: "reviews", kind: "reviews", title: "Reviews", minutes, must: true, target, href: ROUTES.review });
}
