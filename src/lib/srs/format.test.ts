import { describe, expect, it } from "vitest";

import { deckParam, formatNextDue } from "./format";

describe("formatNextDue", () => {
  // 10:30 am IST on Thu 3 Dec.
  const now = new Date("2026-12-03T05:00:00.000Z");
  it("says when the next card is due, in India time", () => {
    expect(formatNextDue(new Date("2026-12-03T13:10:00.000Z"), now)).toBe("at 6:40 pm");
    // 2 am IST still belongs to Thursday's study day.
    expect(formatNextDue(new Date("2026-12-03T20:30:00.000Z"), now)).toBe("at 2:00 am");
    expect(formatNextDue(new Date("2026-12-04T05:00:00.000Z"), now)).toBe("tomorrow");
    expect(formatNextDue(new Date("2026-12-07T05:00:00.000Z"), now)).toBe("on Mon 7 Dec");
  });
});

describe("deckParam", () => {
  it("reads ?deck=", () => {
    expect(deckParam("12")).toBe(12);
    expect(deckParam(["3", "4"])).toBe(3);
    expect(deckParam("x")).toBeNull();
    expect(deckParam(undefined)).toBeNull();
    expect(deckParam("-1")).toBeNull();
  });
});
