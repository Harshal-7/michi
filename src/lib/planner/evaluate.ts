/**
 * Which of the day's tasks are done, worked out from the day's activity (the plan's "Done,
 * streak, progress"), with the done and skipped marks from `task_overrides` on top. Pure;
 * store.ts gathers the activity.
 */
import { daysBetween, type StudyDate } from "@/lib/day";

import type { DayPlan, DayTask, TaskKind } from "./day-plan";
import { SPEAKING_MIN } from "./plan";

/** What happened on the day, as far as the plan's tasks care. */
export type DayActivity = {
  /** Distinct cards graded in review sessions today that weren't introduced today. */
  reviewsGraded: number;
  /** Cards due before the day ends, now. */
  reviewsDueNow: number;
  /** Minutes those review grades took. */
  reviewMinutes: number;
  /** Cards introduced today in the decks the plan gave new items. */
  introduced: number;
  /** Items the quick check covered today, and how many it has left. */
  quickChecked: number;
  quickCheckLeft: number;
  /** Minutes logged today outside class, by skill. */
  minutes: Partial<Record<"listening" | "speaking" | "reading", number>>;
  /** Dates of the class logs the plan's class tasks ask about. */
  classLogDates: readonly StudyDate[];
  /** Assessments submitted: today's daily quiz, weekly tests by week start, today's mock. */
  quizSubmitted: boolean;
  weeklySubmitted: readonly StudyDate[];
  mockSubmitted: boolean;
  /** Today's grammar point got a status change, a note or a sentence. */
  grammarTouched: boolean;
};

export const NO_ACTIVITY: DayActivity = {
  reviewsGraded: 0,
  reviewsDueNow: 0,
  reviewMinutes: 0,
  introduced: 0,
  quickChecked: 0,
  quickCheckLeft: 0,
  minutes: {},
  classLogDates: [],
  quizSubmitted: false,
  weeklySubmitted: [],
  mockSubmitted: false,
  grammarTouched: false,
};

export type TaskMark = "done" | "skipped";
export type TaskState = "done" | "skipped" | "todo";

export type TaskStatus = {
  task: DayTask;
  state: TaskState;
  /** Done from the day's activity rather than by hand. */
  auto: boolean;
  /** Set by hand (it can be undone). */
  mark: TaskMark | null;
  /** How far along a counted task is. */
  progress: { done: number; of: number } | null;
};

export type DayStatus = {
  tasks: TaskStatus[];
  /** The first task still to do. */
  next: string | null;
  done: number;
  /** Every task done or skipped, and at least one done. */
  finished: boolean;
};

/** The date in a carried task's key ("log_class:2027-01-02"), or null. */
export function keyDate(key: string): StudyDate | null {
  const part = key.split(":")[1];
  return part && /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : null;
}

function autoProgress(task: DayTask, a: DayActivity): { done: boolean; progress: TaskStatus["progress"] } {
  const counted = (done: number, of: number) => ({ done: done >= of, progress: { done: Math.min(done, of), of } });
  switch (task.kind) {
    case "reviews": {
      const target = task.target ?? 0;
      const result = counted(a.reviewsGraded, target);
      return { ...result, done: result.done || a.reviewsDueNow === 0 };
    }
    case "quick_check": {
      const result = counted(a.quickChecked, task.target ?? 0);
      return { ...result, done: result.done || a.quickCheckLeft === 0 };
    }
    case "new_items":
      return counted(a.introduced, task.target ?? 0);
    case "speaking":
      return counted(a.minutes.speaking ?? 0, Math.min(SPEAKING_MIN, task.minutes));
    case "listening":
      return counted(a.minutes.listening ?? 0, task.minutes);
    case "reading":
      return counted(a.minutes.reading ?? 0, task.minutes);
    case "class":
    case "log_class": {
      const date = keyDate(task.key);
      return { done: date !== null && a.classLogDates.includes(date), progress: null };
    }
    case "daily_quiz":
      return { done: a.quizSubmitted, progress: null };
    case "weekly_test": {
      const week = keyDate(task.key);
      return { done: week !== null && a.weeklySubmitted.includes(week), progress: null };
    }
    case "mock":
      return { done: a.mockSubmitted, progress: null };
    case "grammar":
      return { done: a.grammarTouched, progress: null };
    default:
      return { done: false, progress: null };
  }
}

/**
 * Each task's state. Done from the activity wins (a skipped task you then do is done); otherwise
 * a mark set by hand; otherwise to do.
 */
export function evaluate(
  plan: Pick<DayPlan, "tasks">,
  activity: DayActivity,
  marks: Readonly<Record<string, TaskMark>> = {},
): DayStatus {
  const tasks = plan.tasks.map((task): TaskStatus => {
    const { done, progress } = autoProgress(task, activity);
    const mark = marks[task.key] ?? null;
    const state: TaskState = done ? "done" : (mark ?? "todo");
    return { task, state, auto: done, mark, progress };
  });
  const doneCount = tasks.filter((t) => t.state === "done").length;
  return {
    tasks,
    next: tasks.find((t) => t.state === "todo")?.task.key ?? null,
    done: doneCount,
    finished: tasks.length > 0 && doneCount > 0 && tasks.every((t) => t.state !== "todo"),
  };
}

/** Reviews carry over through their due dates; these carry over as tasks. */
export const CARRY_OVER_KINDS: readonly TaskKind[] = ["log_class", "weekly_test"];
/** The weekly test stays open until Wednesday: 3 days after its Sunday. */
const WEEKLY_TEST_OPEN_DAYS = 3;

/** Yesterday's unfinished tasks that carry over to `today`. Skipped ones don't. */
export function carryOver(status: DayStatus, today: StudyDate): DayTask[] {
  return status.tasks
    .filter((t) => t.state === "todo" && CARRY_OVER_KINDS.includes(t.task.kind))
    .filter((t) => {
      if (t.task.kind !== "weekly_test") return true;
      const weekStart = keyDate(t.task.key);
      return weekStart !== null && daysBetween(weekStart, today) <= 6 + WEEKLY_TEST_OPEN_DAYS;
    })
    .map((t) => t.task);
}

/** A day counts towards the streak when Reviews are done (the daily quiz joins in round 2). */
export const STREAK_KINDS: readonly TaskKind[] = ["reviews", "daily_quiz"];

export function countsForStreak(status: DayStatus): boolean {
  const relevant = status.tasks.filter((t) => STREAK_KINDS.includes(t.task.kind));
  return relevant.every((t) => t.state === "done");
}
