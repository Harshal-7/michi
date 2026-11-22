import { describe, expect, it } from "vitest";

import { addDays } from "@/lib/day";

import { isBacklog, levelForPhase, orderQueue, type QueueEntry } from "./queue";
import { KNOWN_FIRST_DAY, KNOWN_LAST_DAY, KNOWN_PER_DAY, pickSpreadDay } from "./spread";

const entry = (id: number, over: Partial<QueueEntry> = {}): QueueEntry => ({
  id,
  state: "review",
  dueAt: `2026-12-01T0${id % 10}:00:00.000Z`,
  level: "N4",
  fromClass: false,
  recall: 0.5,
  ...over,
});

describe("orderQueue", () => {
  it("puts learning cards first, then class and current-level cards, then the rest", () => {
    const cards = [
      entry(1, { level: "N3" }),
      entry(2, { level: "N5" }),
      entry(3, { state: "relearning" }),
      entry(4, { fromClass: true, level: null }),
      entry(5, { state: "learning", dueAt: "2026-12-01T00:30:00.000Z" }),
    ];
    const ids = orderQueue(cards, { currentLevel: "N5", backlog: false }).map((c) => c.id);
    expect(ids).toEqual([5, 3, 2, 4, 1]);
  });

  it("goes by due date in a normal day and by likely recall in a backlog", () => {
    const cards = [
      entry(1, { recall: 0.6 }),
      entry(2, { recall: 0.95 }),
      entry(3, { recall: 0.8 }),
      entry(4, { state: "learning", recall: 0.1 }),
    ];
    expect(orderQueue(cards, { currentLevel: null, backlog: false }).map((c) => c.id)).toEqual([4, 1, 2, 3]);
    // Learning cards still lead; the rest go most-likely-remembered first.
    expect(orderQueue(cards, { currentLevel: null, backlog: true }).map((c) => c.id)).toEqual([4, 2, 3, 1]);
  });

  it("knows a backlog when it sees one", () => {
    expect(isBacklog(40, 10)).toBe(false);
    expect(isBacklog(51, 10)).toBe(true);
    expect(isBacklog(140, 100)).toBe(false);
    expect(isBacklog(151, 100)).toBe(true);
  });

  it("maps phases to levels", () => {
    expect(levelForPhase("n5")).toBe("N5");
    expect(levelForPhase("work")).toBeNull();
    expect(levelForPhase(null)).toBeNull();
  });
});

describe("pickSpreadDay", () => {
  const checkedOn = "2026-12-03";

  it("spreads known items evenly from day 2 to day 28", () => {
    const loads = new Map<string, number>();
    for (let i = 0; i < 270; i++) {
      const day = pickSpreadDay(checkedOn, loads);
      loads.set(day, (loads.get(day) ?? 0) + 1);
    }
    const days = KNOWN_LAST_DAY - KNOWN_FIRST_DAY + 1;
    expect(loads.size).toBe(days);
    expect([...loads.keys()].sort()[0]).toBe(addDays(checkedOn, KNOWN_FIRST_DAY));
    expect(Math.max(...loads.values()) - Math.min(...loads.values())).toBeLessThanOrEqual(1);
  });

  it("never puts more than 30 on a day, going past 4 weeks when it must", () => {
    const loads = new Map<string, number>([[addDays(checkedOn, 5), 29]]);
    for (let i = 0; i < 1000; i++) {
      const day = pickSpreadDay(checkedOn, loads);
      loads.set(day, (loads.get(day) ?? 0) + 1);
    }
    expect(Math.max(...loads.values())).toBe(KNOWN_PER_DAY);
    expect([...loads.keys()].sort().at(-1)! > addDays(checkedOn, KNOWN_LAST_DAY)).toBe(true);
  });
});
