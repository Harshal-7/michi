import { readFileSync } from "node:fs";

import type { Kana } from "@content/schema";
import { describe, expect, it } from "vitest";

import { kanaChart, kanaCounts, type KanaRow } from "./kana";

const content = JSON.parse(readFileSync(new URL("../../../content/generated/kana.json", import.meta.url), "utf8")) as Kana[];
const rows = (script: string): KanaRow[] =>
  content
    .filter((k) => k.script === script)
    .map((k, i) => ({
      id: i + 1,
      kana: k.kana,
      romaji: k.romaji,
      group: k.group as KanaRow["group"],
      example: null,
      lookalikes: k.lookalikes,
      status: "new",
    }));
const glyphs = (row: ({ kana: string } | null)[]) => row.map((c) => c?.kana ?? "·").join("");

describe("kana charts", () => {
  const hiragana = kanaChart(rows("hiragana"));
  const katakana = kanaChart(rows("katakana"));

  it("lays the basic hiragana out in the gojūon table, gaps and all", () => {
    const basic = hiragana.find((s) => s.group === "basic")!;
    expect(basic.rows.map(glyphs)).toEqual([
      "あいうえお",
      "かきくけこ",
      "さしすせそ",
      "たちつてと",
      "なにぬねの",
      "はひふへほ",
      "まみむめも",
      "や·ゆ·よ",
      "らりるれろ",
      "わ···を",
      "ん····",
    ]);
  });

  it("puts dakuten in five rows and the combinations in threes", () => {
    expect(hiragana.find((s) => s.group === "dakuten")!.rows.map(glyphs)).toEqual(["がぎぐげご", "ざじずぜぞ", "だぢづでど", "ばびぶべぼ", "ぱぴぷぺぽ"]);
    const combo = hiragana.find((s) => s.group === "combo")!;
    expect(combo.cols).toBe(3);
    expect(combo.rows).toHaveLength(11);
    expect(glyphs(combo.rows[0])).toBe("きゃきゅきょ");
  });

  it("gives katakana its extended sounds, five to a row, and no section is missing a character", () => {
    expect(katakana.map((s) => s.group)).toEqual(["basic", "dakuten", "combo", "extended"]);
    expect(katakana.find((s) => s.group === "extended")!.rows).toHaveLength(4);
    for (const [script, sections] of [
      ["hiragana", hiragana],
      ["katakana", katakana],
    ] as const) {
      expect(sections.flatMap((s) => s.rows.flat()).filter(Boolean)).toHaveLength(rows(script).length);
    }
  });

  it("counts characters by status", () => {
    expect(kanaCounts([{ status: "review" }, { status: "new" }, { status: "new" }])).toEqual({ review: 1, learning: 0, new: 2 });
  });
});
