import { describe, expect, it } from "vitest";

import { kanaVerdict, romajiMatches, shortMeaning, spotOptions } from "./quick-check-rules";

describe("quick check rules", () => {
  it("accepts the romaji and its other spellings", () => {
    expect(romajiMatches("shi", "shi", ["si"])).toBe(true);
    expect(romajiMatches(" SI ", "shi", ["si"])).toBe(true);
    expect(romajiMatches("su", "shi", ["si"])).toBe(false);
    expect(romajiMatches("", "n", [])).toBe(false);
  });

  it("counts right and fast as known, slow as unsure, wrong as unknown", () => {
    expect(kanaVerdict(true, 1400)).toBe("known");
    expect(kanaVerdict(true, 4200)).toBe("unsure");
    expect(kanaVerdict(false, 900)).toBe("unknown");
  });

  it("shortens meanings for options", () => {
    expect(shortMeaning("to eat; to live on")).toBe("to eat");
    expect(shortMeaning("day, sun, Japan, counter for days")).toBe("day, sun");
  });

  it("makes four different options with the answer among them and no overlapping wrong one", () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const pool = ["weather forecast", "rain", "to eat", "rain", "snow", "mountain", "river"];
    const { options, answerIndex } = spotOptions("weather", pool, random);
    expect(options).toHaveLength(4);
    expect(new Set(options).size).toBe(4);
    expect(options[answerIndex]).toBe("weather");
    expect(options).not.toContain("weather forecast");
  });
});
