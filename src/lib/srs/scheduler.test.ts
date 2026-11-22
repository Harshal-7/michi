import { describe, expect, it } from "vitest";

import {
  formatInterval,
  gradeCard,
  previewGrades,
  retrievability,
  schedulerFor,
  schedulerOptions,
  type StoredFsrs,
} from "./scheduler";

const SETTINGS = { targetRecall: 0.9, learningSteps: ["1m", "10m"] };
const at = new Date("2026-12-01T03:00:00.000Z");
const minutesAfter = (from: Date, due: Date) => Math.round((due.getTime() - from.getTime()) / 60_000);

describe("FSRS", () => {
  it("keeps the learning steps from settings for a new card", async () => {
    const scheduler = await schedulerFor(SETTINGS);
    const preview = previewGrades(scheduler, { cardId: 7, fsrs: null, now: at });
    expect(minutesAfter(at, preview[1].dueAt)).toBe(1);
    expect(minutesAfter(at, preview[3].dueAt)).toBe(10);
    // Easy skips the steps and goes straight to days.
    expect(minutesAfter(at, preview[4].dueAt)).toBeGreaterThan(24 * 60);
  });

  it("moves the due date further out for a better grade", async () => {
    const scheduler = await schedulerFor(SETTINGS);
    const first = gradeCard(scheduler, { cardId: 7, fsrs: null, grade: 3, at });
    expect(first.columns.state).toBe("learning");
    const later = new Date(first.card.dueAt);
    const due = ([1, 2, 3, 4] as const).map(
      (grade) => gradeCard(scheduler, { cardId: 7, fsrs: first.stored, grade, at: later }).card.dueAt.getTime(),
    );
    expect(due).toEqual([...due].sort((a, b) => a - b));
    const good = gradeCard(scheduler, { cardId: 7, fsrs: first.stored, grade: 3, at: later });
    expect(good.columns).toMatchObject({ state: "review", reps: 2, lapses: 0 });
    expect(good.card.dueAt.getTime() - later.getTime()).toBeGreaterThan(2 * 86_400_000);
  });

  it("counts a lapse and goes back to relearning on Again", async () => {
    const scheduler = await schedulerFor(SETTINGS);
    let fsrs: StoredFsrs | null = null;
    let time = at;
    for (const grade of [3, 3] as const) {
      const graded = gradeCard(scheduler, { cardId: 9, fsrs, grade, at: time });
      fsrs = graded.stored;
      time = graded.card.dueAt;
    }
    const lapse = gradeCard(scheduler, { cardId: 9, fsrs, grade: 1, at: time });
    expect(lapse.columns).toMatchObject({ state: "relearning", lapses: 1 });
    expect(minutesAfter(time, lapse.card.dueAt)).toBe(10);
  });

  it("gives the browser and the server the same answer from the stored card", async () => {
    const scheduler = await schedulerFor(SETTINGS);
    const first = gradeCard(scheduler, { cardId: 11, fsrs: null, grade: 4, at });
    const stored = JSON.parse(JSON.stringify(first.stored)) as StoredFsrs;
    const later = new Date(first.card.dueAt);
    const preview = previewGrades(scheduler, { cardId: 11, fsrs: stored, now: later });
    const saved = gradeCard(scheduler, { cardId: 11, fsrs: stored, grade: 3, at: later });
    expect(saved.card.dueAt.toISOString()).toBe(preview[3].dueAt.toISOString());
  });

  it("estimates recall falling over time", async () => {
    const scheduler = await schedulerFor(SETTINGS);
    const graded = gradeCard(scheduler, { cardId: 3, fsrs: null, grade: 4, at });
    const soon = retrievability(scheduler, 3, graded.stored, new Date(at.getTime() + 86_400_000));
    const late = retrievability(scheduler, 3, graded.stored, new Date(at.getTime() + 90 * 86_400_000));
    expect(soon).toBeGreaterThan(late);
    expect(retrievability(scheduler, 3, null, at)).toBe(0);
  });

  it("takes seconds in learning steps as whole minutes", () => {
    expect(schedulerOptions({ targetRecall: 0.9, learningSteps: ["30s", "10m", "1d"] }).learningSteps).toEqual([
      "1m",
      "10m",
      "1d",
    ]);
  });
});

describe("formatInterval", () => {
  const t = (ms: number) => formatInterval(at, new Date(at.getTime() + ms));
  it("labels the rating buttons", () => {
    expect(t(30_000)).toBe("1 min");
    expect(t(10 * 60_000)).toBe("10 min");
    expect(t(5 * 3_600_000)).toBe("5 h");
    expect(t(86_400_000)).toBe("1 day");
    expect(t(9 * 86_400_000)).toBe("9 days");
    expect(t(120 * 86_400_000)).toBe("4 months");
    expect(t(800 * 86_400_000)).toBe("2.2 years");
  });
});
