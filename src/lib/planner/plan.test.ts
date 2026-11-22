import { describe, expect, it } from "vitest";

import { addDays, daysBetween, type StudyDate, weekday } from "@/lib/day";

import { type DayPlan, TASK_KINDS } from "./day-plan";
import {
  AVAILABLE_TASK_KINDS,
  EXAM_PREP_LISTENING,
  normalReviews,
  plan,
  type PlanInput,
  quickCheckPlan,
  REVIEW_SHARE,
  reviewMinutes,
  TYPICAL,
} from "./plan";
import { planInput, settingsWith } from "./testing";

const total = (p: DayPlan) => p.tasks.reduce((s, t) => s + t.minutes, 0);
const find = (p: DayPlan, kind: string) => p.tasks.find((t) => t.kind === kind);
const fixedKinds = new Set(["class", "log_class", "quick_check", "daily_quiz", "weekly_test", "mock", "speaking"]);

/** Every date from `from` for `days` days. */
const dates = (from: StudyDate, days: number) => Array.from({ length: days }, (_, i) => addDays(from, i));

describe("planner budgets", () => {
  // A day from every week of the whole plan: weekdays, weekends, class days, mock days, exam
  // prep, the day before each exam and both exam days, in every phase.
  const sample = dates("2026-11-22", 7 * 60).filter((d, i) => i % 3 === 0 || ["2027-07-04", "2027-07-03", "2027-12-05", "2027-12-04", "2026-12-26"].includes(d));
  const loads: Partial<PlanInput>[] = [
    { reviews: { due: 0, learningDue: 0 } },
    { reviews: { due: 120, learningDue: 10 } },
    { reviews: { due: 260, learningDue: 30 } },
    { reviews: { due: 900, learningDue: 60 } },
    { quickCheck: { remainingKana: 228, remainingOther: 798, startedOn: null } },
  ];

  for (const kinds of [AVAILABLE_TASK_KINDS, TASK_KINDS]) {
    const label = kinds === AVAILABLE_TASK_KINDS ? "round 1's tasks" : "every task kind";
    it(`stays within the day's budget on every kind of day, with ${label}`, { timeout: 30_000 }, () => {
      for (const date of sample) {
        for (const load of loads) {
          const p = plan(planInput(date, { ...load, available: kinds }));
          // Over the budget only when nothing optional is left to trim.
          const within = total(p) <= p.budgetMinutes || p.tasks.every((t) => t.must);
          expect(within, `${date} ${p.mode} ${total(p)} of ${p.budgetMinutes} ${JSON.stringify(load)}`).toBe(true);
          expect(p.tasks.every((t) => kinds.includes(t.kind))).toBe(true);
        }
      }
    });
  }

  it("gives reviews at most 55% of the time left after the fixed blocks", () => {
    for (const date of ["2026-11-24", "2026-11-28", "2027-01-09", "2027-03-10"]) {
      const p = plan(planInput(date, { reviews: { due: 2000, learningDue: 0 }, available: TASK_KINDS }));
      const fixed = p.tasks.filter((t) => fixedKinds.has(t.kind)).reduce((s, t) => s + t.minutes, 0);
      // Speaking's extra minutes beyond its fixed 10 come later.
      const speakingExtra = Math.max(0, (find(p, "speaking")?.minutes ?? 0) - 10);
      const free = p.budgetMinutes - fixed + speakingExtra;
      expect(find(p, "reviews")!.minutes, date).toBeLessThanOrEqual(Math.floor(REVIEW_SHARE * free));
      expect(p.mode).toBe("recovery");
    }
  });

  it("plans a normal weekday like the typical days table", () => {
    const p = plan(planInput("2026-12-08", { reviews: { due: 64, learningDue: 4 } }));
    expect(p.mode).toBe("normal");
    expect(p.budgetMinutes).toBe(75);
    expect(find(p, "reviews")).toMatchObject({ must: true, target: 64, minutes: reviewMinutes(64) });
    expect(reviewMinutes(64)).toBe(9);
    expect(find(p, "speaking")!.minutes).toBe(10);
    expect(find(p, "listening")!.minutes).toBe(15);
    expect(find(p, "reading")).toBeUndefined();
    expect(p.tasks.map((t) => t.kind)).toEqual(["reviews", "new_items", "speaking", "listening"]);
  });

  it("plans a Phase 1 weekend with reading and more listening", () => {
    const p = plan(planInput("2026-12-12"));
    expect(p.budgetMinutes).toBe(210);
    expect(find(p, "speaking")!.minutes).toBe(TYPICAL.weekend.speaking);
    expect(find(p, "reading")!.minutes).toBe(TYPICAL.weekend.reading);
    expect(find(p, "listening")!.minutes).toBe(TYPICAL.weekend.listening);
  });

  it("puts the class and its log first on class days, once those screens exist", () => {
    const p = plan(planInput("2027-01-09", { available: TASK_KINDS }));
    expect(p.tasks.slice(0, 2).map((t) => [t.kind, t.minutes, t.must])).toEqual([
      ["class", 120, true],
      ["log_class", 10, true],
    ]);
    expect(find(p, "work")?.minutes).toBe(20);
    const round1 = plan(planInput("2027-01-09"));
    expect(find(round1, "class")).toBeUndefined();
    // A "no class" exception makes it an ordinary weekend.
    const off = plan(planInput("2027-01-09", { available: TASK_KINDS, exceptions: [{ date: "2027-01-09", kind: "no_class" }] }));
    expect(find(off, "class")).toBeUndefined();
  });

  it("has only the exam on exam day, and a light day before it", () => {
    for (const exam of ["2027-07-04", "2027-12-05"]) {
      const p = plan(planInput(exam, { available: TASK_KINDS }));
      expect(p).toMatchObject({ mode: "exam_day", tasks: [], budgetMinutes: 0, newQuota: {} });
      const before = plan(planInput(addDays(exam, -1), { available: TASK_KINDS }));
      expect(before.mode).toBe("exam_prep");
      expect(before.budgetMinutes).toBe(105);
      expect(find(before, "mock")).toBeUndefined();
    }
    const custom = plan(planInput("2027-03-10", { exceptions: [{ date: "2027-03-10", kind: "exam" }] }));
    expect(custom.mode).toBe("exam_day");
  });

  it("runs exam prep with no new items, more listening, mocks at weekends and drills on weekdays", () => {
    const weekday = plan(planInput("2027-06-16", { available: TASK_KINDS }));
    expect(weekday.mode).toBe("exam_prep");
    expect(find(weekday, "new_items")).toBeUndefined();
    expect(find(weekday, "daily_quiz")!.title).toBe("Section drill");
    expect(find(weekday, "listening")!.minutes).toBe(Math.round(TYPICAL.weekday.listening * EXAM_PREP_LISTENING));
    const saturday = plan(planInput("2027-06-19", { available: TASK_KINDS }));
    expect(find(saturday, "mock")).toMatchObject({ title: "N4 mock test", minutes: 80, must: true });
    expect(find(saturday, "daily_quiz")).toBeUndefined();
    expect(find(saturday, "listening")).toBeUndefined();
    expect(find(saturday, "work")).toBeUndefined();
  });

  it("schedules mocks: N5 on 26 Dec, N4 monthly from March, N3 monthly from August", () => {
    const mockDays = (from: StudyDate, days: number) =>
      dates(from, days).filter((d) => find(plan(planInput(d, { available: TASK_KINDS })), "mock"));
    expect(mockDays("2026-11-22", 40)).toEqual(["2026-12-26"]);
    expect(mockDays("2027-01-01", 160)).toEqual(["2027-03-06", "2027-04-03", "2027-05-01", "2027-06-05"]);
    expect(mockDays("2027-06-06", 30)).toEqual(["2027-06-19", "2027-06-26"]);
    expect(mockDays("2027-07-05", 150)).toEqual(["2027-08-07", "2027-09-04", "2027-10-02", "2027-11-06", "2027-11-20", "2027-11-27"]);
  });

  it("adds 10 minutes of reading on N3 weekdays", () => {
    expect(find(plan(planInput("2027-07-13")), "reading")!.minutes).toBe(10);
    expect(find(plan(planInput("2027-02-09")), "reading")).toBeUndefined();
  });
});

describe("day modes", () => {
  it("goes into recovery above 1.5 normal days of reviews", () => {
    const normal = normalReviews("weekday");
    expect(plan(planInput("2026-12-08", { reviews: { due: Math.floor(normal * 1.5), learningDue: 0 } })).mode).toBe("normal");
    expect(plan(planInput("2026-12-08", { reviews: { due: Math.floor(normal * 1.5) + 1, learningDue: 0 } })).mode).toBe("recovery");
  });

  it("re-enters gently after 3 or more days away, with a review cap", () => {
    expect(plan(planInput("2026-12-08", { lastActiveDate: "2026-12-05" })).mode).toBe("normal");
    const back = plan(planInput("2026-12-08", { lastActiveDate: "2026-12-04", reviews: { due: 200, learningDue: 0 } }));
    expect(back.mode).toBe("re_entry");
    expect(find(back, "reviews")!.target).toBeLessThanOrEqual(normalReviews("weekday"));
  });

  it("keeps a rest day to learning cards and a few reviews", () => {
    const p = plan(planInput("2026-12-09", { exceptions: [{ date: "2026-12-09", kind: "rest" }], reviews: { due: 90, learningDue: 6 } }));
    expect(p.mode).toBe("rest");
    expect(p.tasks.map((t) => [t.kind, t.target])).toEqual([["reviews", 26]]);
    expect(total(p)).toBeLessThanOrEqual(p.budgetMinutes);
  });

  it("puts exam day before exam prep before recovery", () => {
    const heavy = { reviews: { due: 900, learningDue: 0 } };
    expect(plan(planInput("2027-07-04", heavy)).mode).toBe("exam_day");
    expect(plan(planInput("2027-06-20", heavy)).mode).toBe("exam_prep");
  });
});

describe("the quick check", () => {
  const fresh = { remainingKana: 228, remainingOther: 798, startedOn: null };

  it("spreads what's left over the first 3 days, kana first", () => {
    expect(quickCheckPlan(fresh, "2026-12-03")).toEqual({ target: 342, minutes: 17 });
    expect(quickCheckPlan({ remainingKana: 0, remainingOther: 500, startedOn: "2026-12-03" }, "2026-12-04")!.target).toBe(250);
    expect(quickCheckPlan({ remainingKana: 0, remainingOther: 200, startedOn: "2026-12-03" }, "2026-12-05")!.target).toBe(200);
    expect(quickCheckPlan({ remainingKana: 0, remainingOther: 40, startedOn: "2026-12-03" }, "2026-12-09")!.target).toBe(40);
    expect(quickCheckPlan({ remainingKana: 0, remainingOther: 0, startedOn: "2026-12-03" }, "2026-12-04")).toBeNull();
  });

  it("adds a must-do task and sets the target, and holds back the N5 lists it covers", () => {
    const input = planInput("2026-12-03", { quickCheck: fresh });
    const p = plan(input);
    expect(find(p, "quick_check")).toMatchObject({ must: true, target: 342 });
    expect(p.quickCheckTarget).toBe(342);
    const quotaDecks = Object.keys(p.newQuota).map((id) => input.decks.find((d) => String(d.id) === id)!.slug);
    expect(quotaDecks).toEqual(["n5-grammar"]);
    const after = plan(planInput("2026-12-03"));
    expect(after.quickCheckTarget).toBe(0);
    expect(find(after, "quick_check")).toBeUndefined();
  });
});

describe("plan shape", () => {
  it("lists tasks in a steady order with unique keys and real routes", () => {
    for (const date of dates("2026-11-22", 400).filter((d) => weekday(d) === 0 || weekday(d) === 3)) {
      const p = plan(planInput(date, { available: TASK_KINDS }));
      expect(new Set(p.tasks.map((t) => t.key)).size).toBe(p.tasks.length);
      expect(p.tasks.every((t) => t.href.startsWith("/"))).toBe(true);
      expect(daysBetween(p.date, date)).toBe(0);
    }
  });

  it("follows the budgets in settings", () => {
    const settings = settingsWith({ budgets: { weekdayMinutes: 45 } });
    const p = plan(planInput("2026-12-08", { settings }));
    expect(p.budgetMinutes).toBe(45);
    expect(total(p)).toBeLessThanOrEqual(45);
  });
});
