import { describe, expect, it } from "vitest";

import { cleanName, cleanPin, nameKey, nameProblem, pinProblem, suggestionsFor } from "./names";

describe("player names", () => {
  it("takes 3 to 16 letters, digits, kana or kanji", () => {
    for (const ok of ["Aki", "aki2027", "たなか", "タナカー", "山田太郎", "佐々木", "ab1", "x".repeat(16)]) expect(nameProblem(ok), ok).toBeNull();
    expect(nameProblem("ab")).toMatch(/3 to 16/);
    expect(nameProblem("x".repeat(17))).toMatch(/3 to 16/);
    expect(nameProblem("  ")).toMatch(/3 to 16/);
  });

  it("turns away spaces, symbols and emoji", () => {
    for (const bad of ["Aki Sato", "aki_s", "aki!", "ak😀i", "a.b.c", "<b>x</b>"]) expect(nameProblem(bad), bad).toMatch(/only/);
  });

  it("makes full-width letters and half-width katakana plain, and trims", () => {
    expect(cleanName("  ＡＫＩ ")).toBe("AKI");
    expect(cleanName("ﾀﾅｶ")).toBe("タナカ");
    expect(nameProblem("ﾀﾅｶ")).toBeNull();
  });

  it("treats names that differ only in case or width as the same", () => {
    expect(nameKey("Aki")).toBe(nameKey("ａｋｉ"));
    expect(nameKey("ﾀﾅｶ")).toBe(nameKey("タナカ"));
  });

  it("keeps Michi's and Harshal's names and the blocklist out", () => {
    for (const bad of ["Harshal", "HARSHAL", "admin", "MICHI", "xfuckx", "Hitler88", "死ね死ね"]) {
      expect(nameProblem(bad), bad).toMatch(/isn't available/);
    }
  });
});

describe("name suggestions", () => {
  it("offer the name with a number, counting on from one it ends in", () => {
    expect(suggestionsFor("sakura").slice(0, 2)).toEqual(["sakura1", "sakura2"]);
    expect(suggestionsFor("sakura22").slice(0, 2)).toEqual(["sakura23", "sakura24"]);
    expect(suggestionsFor("Sakura22")).not.toContain("sakura22");
  });

  it("stay 16 characters or fewer, and pass the name rules", () => {
    for (const s of suggestionsFor("abcdefghijklmnop")) {
      expect([...s].length).toBeLessThanOrEqual(16);
      expect(nameProblem(s), s).toBeNull();
    }
    for (const s of suggestionsFor("さくら")) expect(nameProblem(s), s).toBeNull();
  });
});

describe("PINs", () => {
  it("are 4 digits, full-width ones too", () => {
    expect(pinProblem("0420")).toBeNull();
    expect(pinProblem("０４２０")).toBeNull();
    expect(cleanPin(" ０４２０ ")).toBe("0420");
    for (const bad of ["123", "12345", "12a4", "", "12 4"]) expect(pinProblem(bad), bad).not.toBeNull();
  });
});
