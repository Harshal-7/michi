import { describe, expect, it } from "vitest";

import { addDays } from "@/lib/day";

import { type HeatmapDay, heatStep, reviewRun } from "./heatmap";

const week = (start: string, counts: number[], today: string): HeatmapDay[] =>
  counts.map((n, i) => {
    const date = addDays(start, i);
    return { date, reviews: n, future: date > today };
  });

describe("heatmap", () => {
  it("steps darker with more reviews, as F_Progress does", () => {
    expect([0, 1, 49, 50, 99, 100, 400].map(heatStep)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });

  it("counts the days in a row with reviews, not holding today against you", () => {
    const weeks = [week("2026-11-30", [0, 20, 30, 40, 0, 0, 0], "2026-12-03")];
    expect(reviewRun(weeks, "2026-12-03")).toEqual({ days: 3, since: "2026-12-01" });
    const early = [week("2026-11-30", [0, 20, 30, 0, 0, 0, 0], "2026-12-03")];
    expect(reviewRun(early, "2026-12-03")).toEqual({ days: 2, since: "2026-12-01" });
    const gap = [week("2026-11-30", [10, 0, 0, 0, 0, 0, 0], "2026-12-03")];
    expect(reviewRun(gap, "2026-12-03")).toEqual({ days: 0, since: null });
  });
});
