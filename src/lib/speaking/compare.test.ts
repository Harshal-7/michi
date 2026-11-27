import { describe, expect, it } from "vitest";

import { compareSpoken, normalise } from "./compare";

const MODEL = "けさ、{七時|しちじ}にパンとたまごを{食|た}べました。それから、コーヒーをのみました。";

describe("normalise", () => {
  it("drops punctuation and spaces, folds katakana and full-width forms, and writes numbers in kanji", () => {
    expect(normalise("けさ、 七時に。")).toBe("けさ七時に");
    expect(normalise("コーヒー")).toBe("こーひー");
    expect(normalise("７時 10分 23")).toBe("七時十分二十三");
    expect(normalise("ＩＴ会社！")).toBe("it会社");
  });
});

describe("compareSpoken", () => {
  it("marks the part of the model that wasn't said, like the board", () => {
    const c = compareSpoken(MODEL, "けさ七時にパンとたまごを食べました");
    expect(c.segments).toEqual([
      { text: "けさ、{七時|しちじ}にパンとたまごを{食|た}べました。", said: true },
      { text: "それから、コーヒーをのみました。", said: false },
    ]);
    expect(c.said).toBeGreaterThan(0.4);
    expect(c.said).toBeLessThan(0.7);
  });

  it("counts a word heard in kana, in kanji or in digits", () => {
    expect(compareSpoken(MODEL, "けさしちじにぱんとたまごをたべましたそれからこーひーをのみました").said).toBe(1);
    expect(compareSpoken(MODEL, "今朝7時にパンと卵を食べました。それからコーヒーを飲みました。").segments.filter((s) => !s.said).map((s) => s.text)).toEqual([
      // 今朝, 卵 and 飲み are kanji where the model has kana, so they can't be matched.
      "けさ、",
      "たまご",
      "の",
    ]);
  });

  it("ignores spaces and punctuation in what was heard", () => {
    expect(compareSpoken("{毎朝|まいあさ}、{七時|しちじ}に{起|お}きます。", "毎朝 七時に 起きます").said).toBe(1);
  });

  it("marks everything when nothing was heard", () => {
    expect(compareSpoken("はじめまして。", "")).toEqual({ segments: [{ text: "はじめまして。", said: false }], said: 0 });
  });
});
