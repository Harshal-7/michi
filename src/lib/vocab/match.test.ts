import { describe, expect, it } from "vitest";

import { finishKana, sameKana } from "./kana";
import { checkJapanese, checkMeaning, editDistance, meaningForms, normalizeMeaning, typosAllowed } from "./match";

describe("romaji to kana", () => {
  it("turns romaji into hiragana, and capitals into katakana", () => {
    expect(finishKana("taberu")).toBe("たべる");
    expect(finishKana("gakkou")).toBe("がっこう");
    expect(finishKana("kyou")).toBe("きょう");
    expect(finishKana("tsukue")).toBe("つくえ");
    expect(finishKana("KAPPU")).toBe("カップ");
    expect(finishKana("wo")).toBe("を");
  });

  it("finishes a last n and drops spaces", () => {
    expect(finishKana("kan")).toBe("かん");
    expect(finishKana("hon")).toBe("ほん");
    expect(finishKana("kon'nichiha")).toBe("こんにちは");
    expect(finishKana(" ta beru ")).toBe("たべる");
  });

  it("finishes what wanakana left half-done in the box", () => {
    expect(finishKana("かn")).toBe("かん");
    expect(finishKana("たべr")).toBe("たべr");
  });

  it("leaves kana and kanji alone, including full-width input", () => {
    expect(finishKana("会う")).toBe("会う");
    expect(finishKana("コーヒー")).toBe("コーヒー");
    expect(finishKana("ｶｯﾌﾟ")).toBe("カップ");
  });

  it("spells kana one way for comparing", () => {
    expect(sameKana("スーパー")).toBe("すうぱあ");
    expect(sameKana("コーヒー")).toBe("こおひい");
    expect(sameKana("キャー")).toBe("きゃあ");
    expect(sameKana("すーぱー")).toBe("すうぱあ");
    expect(sameKana("su-pa-")).toBe("すうぱあ");
    expect(sameKana("カップ")).toBe(sameKana("かっぷ"));
    expect(sameKana("会う")).toBe("会う");
  });
});

describe("normalizing a meaning", () => {
  it("ignores case, punctuation, articles, a leading to and notes in brackets", () => {
    expect(normalizeMeaning("To Meet")).toBe("meet");
    expect(normalizeMeaning("an apple!")).toBe("apple");
    expect(normalizeMeaning("the day after tomorrow")).toBe("day after tomorrow");
    expect(normalizeMeaning("to be born (of a child)")).toBe("be born");
    expect(normalizeMeaning("well-known")).toBe("well known");
    expect(normalizeMeaning("don't")).toBe("dont");
    expect(normalizeMeaning("theatre")).toBe("theatre");
  });

  it("keeps a note's words when the meaning is only a note", () => {
    expect(normalizeMeaning("(counter for small animals)")).toBe("counter for small animals");
  });

  it("splits meanings at commas and keeps the note as another form", () => {
    expect(meaningForms(["to call out, to invite"])).toEqual(["call out to invite", "call out", "invite"]);
    expect(meaningForms(["(counter for) machines"])).toEqual(["machines", "counter for machines"]);
  });
});

describe("typos", () => {
  it("counts edits, with a swap as one", () => {
    expect(editDistance("paper", "papre")).toBe(1);
    expect(editDistance("paper", "papr")).toBe(1);
    expect(editDistance("library", "libary")).toBe(1);
    expect(editDistance("cat", "dog")).toBe(3);
  });

  it("allows none on short words, one from 5 letters and two from 10", () => {
    expect(typosAllowed("cup")).toBe(0);
    expect(typosAllowed("paper")).toBe(1);
    expect(typosAllowed("refrigerator")).toBe(2);
  });
});

describe("Japanese → English", () => {
  const meet = ["to meet", "to see"];

  it("accepts any meaning, with or without to, a or the", () => {
    expect(checkMeaning("meet", meet)).toMatchObject({ right: true, typo: false, matched: "to meet" });
    expect(checkMeaning("To See.", meet)).toMatchObject({ right: true, matched: "to see" });
    expect(checkMeaning("an apple", ["apple"]).right).toBe(true);
    expect(checkMeaning("the apple", ["an apple"]).right).toBe(true);
  });

  it("accepts either half of a meaning with a comma, and several answers when each is right", () => {
    expect(checkMeaning("invite", ["to call out, to invite"]).right).toBe(true);
    expect(checkMeaning("meet, see", meet).right).toBe(true);
    expect(checkMeaning("meet, banana", meet).right).toBe(false);
  });

  it("ignores notes in brackets on either side", () => {
    expect(checkMeaning("be born", ["to be born (of a child)"]).right).toBe(true);
    expect(checkMeaning("be born (baby)", ["to be born"]).right).toBe(true);
  });

  it("allows a small typo on longer words and says so", () => {
    expect(checkMeaning("papr", ["paper"])).toMatchObject({ right: true, typo: true, matched: "paper" });
    expect(checkMeaning("refridgerator", ["refrigerator"])).toMatchObject({ right: true, typo: true });
    expect(checkMeaning("cap", ["cup"]).right).toBe(false);
  });

  it("offers a near miss for a few letters off or a shared word", () => {
    expect(checkMeaning("cups", ["cup"])).toMatchObject({ right: false, near: true });
    expect(checkMeaning("born", ["to be born"])).toMatchObject({ right: false, near: true });
    expect(checkMeaning("eating", ["to eat"])).toMatchObject({ right: false, near: true });
    expect(checkMeaning("banana", ["paper"])).toMatchObject({ right: false, near: false });
    expect(checkMeaning("thing", ["to do something"]).near).toBe(false);
  });

  it("treats an empty answer as wrong", () => {
    expect(checkMeaning("  ", meet)).toEqual({ right: false, typo: false, near: false, matched: null });
  });
});

describe("English → Japanese", () => {
  const au = { term: "会う", reading: "あう", forms: ["逢う", "遭う"] };

  it("accepts the reading in hiragana, katakana or romaji, and the written form", () => {
    expect(checkJapanese("あう", au).right).toBe(true);
    expect(checkJapanese("アウ", au).right).toBe(true);
    expect(checkJapanese("au", au)).toMatchObject({ right: true, typed: "あう" });
    expect(checkJapanese("会う", au).right).toBe(true);
    expect(checkJapanese("逢う", au).right).toBe(true);
  });

  it("accepts katakana words in hiragana and with a long-vowel mark either way", () => {
    const cup = { term: "カップ", reading: "カップ" };
    expect(checkJapanese("kappu", cup).right).toBe(true);
    expect(checkJapanese("KAPPU", cup).right).toBe(true);
    const coffee = { term: "コーヒー", reading: "コーヒー" };
    expect(checkJapanese("ko-hi-", coffee).right).toBe(true);
    expect(checkJapanese("koohii", coffee).right).toBe(true);
    expect(checkJapanese("keeki", { term: "ケーキ", reading: "ケーキ" }).right).toBe(true);
  });

  it("counts another word with the same meaning as right and names it", () => {
    const big = { term: "大きい", reading: "おおきい", others: [{ term: "大きな", reading: "おおきな", meaning: "big; large" }] };
    expect(checkJapanese("おおきな", big)).toMatchObject({ right: true, other: { term: "大きな" } });
    expect(checkJapanese("大きな", big).other?.reading).toBe("おおきな");
  });

  it("offers a near miss one kana off, never counting it right by itself", () => {
    const grandma = { term: "おばあさん", reading: "おばあさん" };
    expect(checkJapanese("obasan", grandma)).toMatchObject({ right: false, near: true, typed: "おばさん" });
    expect(checkJapanese("い", { term: "胃", reading: "い" }).right).toBe(true);
    expect(checkJapanese("え", { term: "絵", reading: "え" }).near).toBe(false);
    expect(checkJapanese("", au)).toMatchObject({ right: false, near: false });
  });
});
