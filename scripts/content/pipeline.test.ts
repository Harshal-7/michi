/** Unit tests for the content pipeline's text handling: furigana, deck notes, meanings, kana. */
import { describe, expect, it } from "vitest";

import { buildKana } from "./kana";
import { checkJa } from "./lib/check-ja";
import { normaliseDeckRow } from "./lib/load";
import { alignments, charReadings, type KanjiReadings, plausible, rubyWord } from "./lib/ruby";
import { parseBLine } from "./lib/tatoeba";
import { splitMeanings } from "./words";

const kr: KanjiReadings = new Map(
  Object.entries({
    食: ["た", "しょく"],
    引: ["ひ", "いん"],
    出: ["で", "だ", "しゅつ"],
    日: ["にち", "ひ", "び", "か"],
    曜: ["よう"],
    今: ["いま", "こん", "きん"],
    人: ["ひと", "にん", "じん", "びと"],
  }).map(([k, v]) => [k, new Set(v)]),
);

describe("furigana", () => {
  it("lines a reading up with the kanji runs", () => {
    expect(alignments("食べる", "たべる")).toEqual([["た"]]);
    expect(rubyWord("食べる", "たべる", kr)).toBe("{食|た}べる");
    expect(rubyWord("引き出し", "ひきだし", kr)).toBe("{引|ひ}き{出|だ}し");
    expect(rubyWord("日曜日", "にちようび", kr)).toBe("{日曜日|にちようび}");
    expect(rubyWord("ひらがな", "ひらがな", kr)).toBe("ひらがな");
  });

  it("accepts words that only read as a whole (今日) and gives up on a reading that doesn't fit", () => {
    expect(rubyWord("今日", "きょう", kr)).toBe("{今日|きょう}");
    expect(rubyWord("食べる", "のむ", kr)).toBeNull();
  });

  it("checks readings kanji by kanji, with sound changes", () => {
    expect(plausible("人々", "ひとびと", kr)).toBe(true);
    expect(plausible("今日", "きょう", kr)).toBe(false);
    expect(charReadings("日曜", "にちよう", kr)).toEqual(["にち", "よう"]);
  });

  it("reads a Tatoeba B-line", () => {
    expect(parseBLine("彼(かれ)[01] は 来る{来ました} ログアウト~")).toEqual([
      { head: "彼", reading: "かれ", surface: undefined, good: false },
      { head: "は", reading: undefined, surface: undefined, good: false },
      { head: "来る", reading: undefined, surface: "来ました", good: false },
      { head: "ログアウト", reading: undefined, surface: undefined, good: true },
    ]);
  });
});

describe("hand-written Japanese", () => {
  it("finds kanji without ruby, readings that aren't kana and missing blanks", () => {
    expect(checkJa("{雨|あめ}が{降|ふ}る")).toEqual([]);
    expect(checkJa("雨がふる")).toEqual(["kanji without ruby: 雨"]);
    expect(checkJa("{雨|ame}")).toEqual(["reading isn't kana: {雨|ame}"]);
    expect(checkJa("{雨|あめ}です", { needsBlank: true })).toEqual(["needs exactly one [[answer]], found 0"]);
    expect(checkJa("{猫|ねこ}です", { allowedKanji: new Set(["犬"]) })).toEqual(["kanji above level: 猫"]);
  });
});

describe("word lists", () => {
  it("reads the notes in the lists' forms and readings", () => {
    expect(normaliseDeckRow("いい", "いい; よい")).toMatchObject({ forms: ["いい"], reading: "いい" });
    expect(normaliseDeckRow("結婚", "けっこん (する)")).toMatchObject({ reading: "けっこん", suru: true });
    expect(normaliseDeckRow("運動", "うんどうする")).toMatchObject({ reading: "うんどう", suru: true });
    expect(normaliseDeckRow("しまった (かん)", "しまった (かん)")).toMatchObject({ forms: ["しまった"], interjection: true });
    expect(normaliseDeckRow("～(て) しまう", "～(て) しまう")).toMatchObject({ forms: ["〜てしまう"], reading: "〜てしまう" });
    expect(normaliseDeckRow("十", "(〜を) とお")).toMatchObject({ reading: "とお" });
    expect(normaliseDeckRow("いただく", "頂く")).toMatchObject({ forms: ["いただく", "頂く"], reading: "いただく" });
    expect(normaliseDeckRow("ごらんになる", "")).toMatchObject({ reading: "ごらんになる" });
  });

  it("splits meanings on commas and semicolons outside brackets", () => {
    expect(splitMeanings("to meet, to see")).toEqual(["to meet", "to see"]);
    expect(splitMeanings("kind, warm(hearted), thick")).toEqual(["kind", "warm(hearted)", "thick"]);
    expect(splitMeanings("hot (in reference to weather, air), warm; 1,000")).toEqual(["hot (in reference to weather, air)", "warm", "1,000"]);
  });
});

describe("kana", () => {
  const kana = buildKana([
    { term: "あさ", reading: "あさ", meaning: "morning" },
    { term: "シャツ", reading: "シャツ", meaning: "shirt" },
  ]);

  it("gives every kana a unique slug and Hepburn romaji", () => {
    expect(new Set(kana.map((k) => k.slug)).size).toBe(kana.length);
    expect(kana.find((k) => k.kana === "し")).toMatchObject({ romaji: "shi", accept: ["si"] });
    expect(kana.find((k) => k.kana === "ぢ")).toMatchObject({ slug: "kana:hiragana:dji", romaji: "ji" });
  });

  it("links the classic look-alikes both ways", () => {
    expect(kana.find((k) => k.kana === "シ")?.lookalikes).toContain("ツ");
    expect(kana.find((k) => k.kana === "ツ")?.lookalikes).toContain("シ");
    expect(kana.find((k) => k.kana === "ソ")?.lookalikes).toContain("ン");
    expect(kana.find((k) => k.kana === "ね")?.lookalikes).toEqual(expect.arrayContaining(["わ", "れ"]));
    expect(kana.find((k) => k.kana === "ぬ")?.lookalikes).toContain("め");
  });

  it("picks an N5 word that shows the kana", () => {
    expect(kana.find((k) => k.kana === "あ")?.example?.term).toBe("あさ");
    expect(kana.find((k) => k.kana === "シャ")?.example?.term).toBe("シャツ");
  });
});
