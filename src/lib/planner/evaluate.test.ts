import { describe, expect, it } from "vitest";

import { DayPlan, ROUTES } from "./day-plan";
import { carryOver, countsForStreak, type DayActivity, evaluate, NO_ACTIVITY } from "./evaluate";

const plan = DayPlan.parse({
  version: 1,
  date: "2026-12-08",
  mode: "normal",
  budgetMinutes: 75,
  tasks: [
    { key: "reviews", kind: "reviews", title: "Reviews", minutes: 9, must: true, target: 64, href: ROUTES.review },
    { key: "new_items", kind: "new_items", title: "New items", minutes: 15, must: false, target: 14, href: ROUTES.newItems },
    { key: "speaking", kind: "speaking", title: "Speaking", minutes: 10, must: false, href: ROUTES.minutes },
    { key: "listening", kind: "listening", title: "Listening", minutes: 15, must: false, href: ROUTES.minutes },
  ],
  newQuota: { "4": 2, "5": 12 },
  quickCheckTarget: 0,
});
const busy: DayActivity = { ...NO_ACTIVITY, reviewsDueNow: 64 };
const state = (activity: DayActivity, marks = {}) =>
  Object.fromEntries(evaluate(plan, activity, marks).tasks.map((t) => [t.task.key, t.state]));

describe("evaluate", () => {
  it("starts with everything to do and the first task up next", () => {
    const s = evaluate(plan, busy);
    expect(s.tasks.map((t) => t.state)).toEqual(["todo", "todo", "todo", "todo"]);
    expect(s.next).toBe("reviews");
    expect(s.finished).toBe(false);
  });

  it("ticks Reviews once the frozen number is graded, or when nothing is due", () => {
    expect(state({ ...busy, reviewsGraded: 63 }).reviews).toBe("todo");
    expect(state({ ...busy, reviewsGraded: 64 }).reviews).toBe("done");
    expect(state({ ...busy, reviewsGraded: 10, reviewsDueNow: 0 }).reviews).toBe("done");
    expect(evaluate(plan, { ...busy, reviewsGraded: 30 }).tasks[0].progress).toEqual({ done: 30, of: 64 });
  });

  it("ticks New items when today's introductions reach the quota", () => {
    expect(state({ ...busy, introduced: 13 }).new_items).toBe("todo");
    expect(state({ ...busy, introduced: 14 }).new_items).toBe("done");
  });

  it("ticks speaking at 10 minutes and listening at its planned minutes", () => {
    const s = state({ ...busy, minutes: { speaking: 10, listening: 14 } });
    expect([s.speaking, s.listening]).toEqual(["done", "todo"]);
    expect(state({ ...busy, minutes: { listening: 15 } }).listening).toBe("done");
  });

  it("applies marks set by hand, and lets real work win over a skip", () => {
    const marked = evaluate(plan, busy, { listening: "skipped", speaking: "done" });
    expect(marked.tasks.map((t) => [t.task.key, t.state, t.auto])).toEqual([
      ["reviews", "todo", false],
      ["new_items", "todo", false],
      ["speaking", "done", false],
      ["listening", "skipped", false],
    ]);
    expect(state({ ...busy, minutes: { listening: 20 } }, { listening: "skipped" }).listening).toBe("done");
  });

  it("is finished when every task is done or skipped", () => {
    const s = evaluate(plan, { ...busy, reviewsGraded: 64, introduced: 14, minutes: { speaking: 12 } }, { listening: "skipped" });
    expect(s.finished).toBe(true);
    expect(s.next).toBeNull();
    const allSkipped = evaluate(plan, busy, { reviews: "skipped", new_items: "skipped", speaking: "skipped", listening: "skipped" });
    expect(allSkipped.finished).toBe(false);
  });

  it("counts a day for the streak when Reviews are done", () => {
    expect(countsForStreak(evaluate(plan, { ...busy, reviewsGraded: 64 }))).toBe(true);
    expect(countsForStreak(evaluate(plan, busy))).toBe(false);
    expect(countsForStreak(evaluate(plan, busy, { reviews: "done" }))).toBe(true);
    expect(countsForStreak(evaluate(plan, busy, { reviews: "skipped" }))).toBe(false);
    // Exam day has no tasks, and counts.
    expect(countsForStreak(evaluate({ tasks: [] }, NO_ACTIVITY))).toBe(true);
  });
});

describe("carry-over", () => {
  const sunday = DayPlan.parse({
    ...plan,
    date: "2027-01-10",
    tasks: [
      ...plan.tasks,
      { key: "log_class:2027-01-10", kind: "log_class", title: "Log today's class", minutes: 10, must: true, href: ROUTES.log },
      { key: "weekly_test:2027-01-04", kind: "weekly_test", title: "Weekly test", minutes: 20, must: true, href: ROUTES.practice },
    ],
  });

  it("carries an unlogged class and the weekly test, not the rest", () => {
    const keys = carryOver(evaluate(sunday, busy), "2027-01-11").map((t) => t.key);
    expect(keys).toEqual(["log_class:2027-01-10", "weekly_test:2027-01-04"]);
  });

  it("keeps the weekly test open until Wednesday, and drops whatever was done or skipped", () => {
    expect(carryOver(evaluate(sunday, busy), "2027-01-14").map((t) => t.kind)).toEqual(["log_class"]);
    const logged = { ...busy, classLogDates: ["2027-01-10"], weeklySubmitted: ["2027-01-04"] };
    expect(carryOver(evaluate(sunday, logged), "2027-01-11")).toEqual([]);
    expect(carryOver(evaluate(sunday, busy, { "weekly_test:2027-01-04": "skipped" }), "2027-01-11").map((t) => t.kind)).toEqual([
      "log_class",
    ]);
  });
});
