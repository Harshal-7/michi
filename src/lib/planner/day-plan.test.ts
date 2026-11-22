import { describe, expect, it } from "vitest";

import { DayPlan, newQuotaFor, ROUTES } from "./day-plan";

const plan = {
  version: 1,
  date: "2026-11-23",
  mode: "normal",
  budgetMinutes: 75,
  tasks: [
    { key: "reviews", kind: "reviews", title: "Reviews", minutes: 20, must: true, target: 64, href: ROUTES.review },
    { key: "new", kind: "new_items", title: "New items", minutes: 15, must: false, target: 14, href: ROUTES.newItems },
    { key: "quiz", kind: "daily_quiz", title: "Daily quiz", minutes: 6, must: true, href: ROUTES.practice },
  ],
  newQuota: { "3": 2, "4": 12 },
  quickCheckTarget: 0,
};

describe("day plan contract", () => {
  it("parses a plan and reads a deck's quota", () => {
    const parsed = DayPlan.parse(plan);
    expect(newQuotaFor(parsed, 4)).toBe(12);
    expect(newQuotaFor(parsed, 9)).toBe(0);
    expect(newQuotaFor(null, 4)).toBe(0);
  });

  it("rejects a plan with a bad date or task kind", () => {
    expect(DayPlan.safeParse({ ...plan, date: "23 Nov" }).success).toBe(false);
    expect(DayPlan.safeParse({ ...plan, tasks: [{ ...plan.tasks[0], kind: "nap" }] }).success).toBe(false);
  });
});
