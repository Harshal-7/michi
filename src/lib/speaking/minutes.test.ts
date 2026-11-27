import { describe, expect, it } from "vitest";

import { capMinutes, sessionMinutes } from "./minutes";

describe("sessionMinutes", () => {
  const start = Date.parse("2026-12-03T05:00:00Z");
  const after = (min: number) => start + min * 60_000;

  it("counts whole minutes from start to done", () => {
    expect(sessionMinutes(start, after(10))).toBe(10);
    expect(sessionMinutes(start, after(4.4))).toBe(4);
    expect(sessionMinutes(start, after(4.6))).toBe(5);
  });

  it("logs at least one minute", () => {
    expect(sessionMinutes(start, after(0.2))).toBe(1);
    expect(sessionMinutes(start, start)).toBe(1);
    // A clock that went backwards still logs something small.
    expect(sessionMinutes(start, after(-5))).toBe(1);
  });

  it("stops at 30 minutes", () => {
    expect(sessionMinutes(start, after(30))).toBe(30);
    expect(sessionMinutes(start, after(240))).toBe(30);
  });

  it("holds any number to 1–30", () => {
    expect(capMinutes(Number.NaN)).toBe(1);
    expect(capMinutes(99)).toBe(30);
    expect(capMinutes(7.2)).toBe(7);
  });
});
