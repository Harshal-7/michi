import { describe, expect, it } from "vitest";

import { addDays, type StudyDate } from "@/lib/day";

import { streakOf } from "./streak";

/** Days from `from` on, counted where the pattern has "x" ("." is a miss). */
function days(from: StudyDate, pattern: string): Set<StudyDate> {
  const out = new Set<StudyDate>();
  [...pattern].forEach((c, i) => c === "x" && out.add(addDays(from, i)));
  return out;
}

// Mon 30 Nov 2026 starts a week.
const MON = "2026-11-30";

describe("streak", () => {
  it("counts days in a row, today included once it's done", () => {
    expect(streakOf(days(MON, "xxxx"), MON, "2026-12-03")).toEqual({ current: 4, best: 4, thisWeek: 4, forgivenThisWeek: false });
  });

  it("doesn't hold today against you while it's still going", () => {
    expect(streakOf(days(MON, "xxx"), MON, "2026-12-03").current).toBe(3);
  });

  it("forgives one missed day a week, which neither breaks nor adds to it", () => {
    const s = streakOf(days(MON, "xx.xxxx"), MON, "2026-12-06");
    expect(s).toMatchObject({ current: 6, thisWeek: 6, forgivenThisWeek: true });
  });

  it("breaks at a second miss in the same week", () => {
    expect(streakOf(days(MON, "x.x.xxx"), MON, "2026-12-06").current).toBe(4);
  });

  it("forgives one miss in each week", () => {
    // Mon–Sun with Wed missed, then Mon–Sun with Thu missed.
    expect(streakOf(days(MON, "xx.xxxx" + "xxx.xxx"), MON, "2026-12-13").current).toBe(12);
  });

  it("keeps the best streak after a break", () => {
    const s = streakOf(days(MON, "xxxxxxx" + "..x"), MON, "2026-12-09");
    expect(s).toMatchObject({ current: 1, best: 7 });
  });

  it("doesn't count days before the first plan as missed", () => {
    expect(streakOf(days("2026-12-03", "xx"), "2026-12-03", "2026-12-04").current).toBe(2);
    expect(streakOf(new Set(), null, "2026-12-04")).toEqual({ current: 0, best: 0, thisWeek: 0, forgivenThisWeek: false });
  });
});
