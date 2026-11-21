import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { blanks, CONTENT_FILES, CONTENT_KEYS, type ContentFile, isValidRuby, parseRuby, toPlain } from "./schema";

const read = (name: ContentFile) =>
  JSON.parse(readFileSync(new URL(`./generated/${name}.json`, import.meta.url), "utf8")) as unknown;

describe("generated content matches the contract", () => {
  for (const name of Object.keys(CONTENT_FILES) as ContentFile[]) {
    it(`${name}.json parses and its keys are unique`, () => {
      const records = CONTENT_FILES[name].parse(read(name)) as Record<string, unknown>[];
      const keys = records.map((r) => r[CONTENT_KEYS[name]]);
      expect(new Set(keys).size).toBe(keys.length);
    });
  }
});

describe("ruby and fill-in markup", () => {
  it("splits ruby into segments", () => {
    expect(parseRuby("{食|た}べる")).toEqual([{ text: "食", reading: "た" }, { text: "べる" }]);
    expect(parseRuby("{今日|きょう}は{晴|は}れ")).toEqual([
      { text: "今日", reading: "きょう" },
      { text: "は" },
      { text: "晴", reading: "は" },
      { text: "れ" },
    ]);
    expect(parseRuby("ひらがな")).toEqual([{ text: "ひらがな" }]);
  });

  it("rejects broken ruby", () => {
    expect(isValidRuby("{食|た}べる")).toBe(true);
    expect(isValidRuby("{食|た べる")).toBe(false);
    expect(isValidRuby("{食}べる")).toBe(false);
  });

  it("finds blanks and makes plain text", () => {
    const s = "{雨|あめ}が{降|ふ}っている[[から]]、{出|で}かけません。";
    expect(blanks(s)).toEqual(["から"]);
    expect(toPlain(s)).toBe("雨が降っているから、出かけません。");
    expect(toPlain("[[{来|き}た]]")).toBe("来た");
  });
});
