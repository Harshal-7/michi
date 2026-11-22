/**
 * The contract between the planner and the screens that act on the day's plan.
 *
 * Round 1 builds both sides at once: the Today session writes the planner, which builds the plan
 * once per study day and stores it in `day_plans.plan`; the Flashcards session's review, new-item
 * and quick-check screens read it through `readDayPlan`. Adding an optional field is safe.
 * Renaming or removing one breaks the other side, so change both in the same PR.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";

import type { DbOrTx } from "@/db/client";
import { dayPlans } from "@/db/schema";
import { isStudyDate, type StudyDate } from "@/lib/day";

/** Where each task's Start button goes. Screens that later rounds build are listed too. */
export const ROUTES = {
  today: "/",
  /** Learning and due review cards; `?deck=<id>` limits it to one deck. */
  review: "/review",
  /** Today's new cards: introduced, then graded. */
  newItems: "/review/new",
  quickCheck: "/quick-check",
  decks: "/decks",
  practice: "/practice",
  /** Kana charts, verb forms and grammar. */
  learn: "/learn",
  grammar: "/grammar",
  /** The next N5 grammar lesson not read yet (the read-through). */
  nextLesson: "/grammar/next",
  log: "/log",
  minutes: "/log/minutes",
  settings: "/settings",
  voice: "/settings/voice",
  flags: "/settings/flags",
} as const;

/** First match wins (the plan's "Day modes"). */
export const DAY_MODES = ["exam_day", "exam_prep", "recovery", "re_entry", "rest", "normal"] as const;
export type DayMode = (typeof DAY_MODES)[number];

export const TASK_KINDS = [
  "reviews",
  "quick_check",
  /** The N5 grammar read-through (decision 6): today's share of lessons, opened at ROUTES.nextLesson. */
  "read_through",
  "new_items",
  "class",
  "log_class",
  "grammar",
  "daily_quiz",
  "weekly_test",
  "mock",
  "speaking",
  "listening",
  "reading",
  "work",
] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const DayTask = z.object({
  /** Stable within the day; `task_overrides` marks a task done or skipped by this key. */
  key: z.string().min(1),
  kind: z.enum(TASK_KINDS),
  title: z.string().min(1),
  minutes: z.int().min(0),
  must: z.boolean(),
  /**
   * Reviews: cards due when the plan was frozen. New items and quick check: how many items.
   * Other kinds leave it out.
   */
  target: z.int().min(0).optional(),
  href: z.string().startsWith("/"),
});
export type DayTask = z.infer<typeof DayTask>;

export const DayPlan = z.object({
  version: z.literal(1),
  date: z.string().refine(isStudyDate, "a study date"),
  mode: z.enum(DAY_MODES),
  budgetMinutes: z.int().min(0),
  tasks: z.array(DayTask),
  /**
   * New cards to introduce today, per deck id (the key is the id as a string), after the caps and
   * the time left. Decks that get none are left out. `/review/new` introduces exactly these.
   */
  newQuota: z.record(z.string().regex(/^\d+$/), z.int().min(0)),
  /** Items the quick check should cover today; 0 once it's finished or on days without it. */
  quickCheckTarget: z.int().min(0),
});
export type DayPlan = z.infer<typeof DayPlan>;

/** Today's frozen plan, or null when no page has built it yet. */
export async function readDayPlan(db: DbOrTx, date: StudyDate): Promise<DayPlan | null> {
  const [row] = await db
    .select({ plan: dayPlans.plan })
    .from(dayPlans)
    .where(eq(dayPlans.studyDate, date))
    .limit(1);
  return row ? DayPlan.parse(row.plan) : null;
}

/** The new-card quota for one deck. */
export function newQuotaFor(plan: DayPlan | null, deckId: number): number {
  return plan?.newQuota[String(deckId)] ?? 0;
}
