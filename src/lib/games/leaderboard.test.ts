import { describe, expect, it } from "vitest";

import { placeFor } from "./leaderboard";

const rows = [
  { score: 100, meanMs: 900 },
  { score: 92, meanMs: 1200 },
  { score: 92, meanMs: 1600 },
  { score: 80, meanMs: null },
];

describe("where a score would land", () => {
  it("comes after every higher score, and after equal scores played as quick or quicker", () => {
    expect(placeFor(101, 2000, rows)).toBe(1);
    expect(placeFor(95, 1000, rows)).toBe(2);
    expect(placeFor(92, 1000, rows)).toBe(2);
    expect(placeFor(92, 1200, rows)).toBe(3);
    expect(placeFor(92, 2000, rows)).toBe(4);
    // A run with no time (nothing right) sorts after one with a time, as on the board.
    expect(placeFor(80, 5000, rows)).toBe(4);
    expect(placeFor(80, null, rows)).toBe(5);
    expect(placeFor(10, null, [])).toBe(1);
  });
});
