import { toPlain } from "@content/schema";
import { describe, expect, it } from "vitest";

import { checkJa } from "../../../scripts/content/lib/check-ja";
import { conjugate, FORM_GUIDES, FORMS, GROUP_NOTES, stem, VERBS } from "./verbs";

/** Every form of every verb in the table, written out by hand. */
const EXPECTED: Record<string, string[]> = {
  買う: ["買う", "買います", "買わない", "買って", "買った"],
  待つ: ["待つ", "待ちます", "待たない", "待って", "待った"],
  入る: ["入る", "入ります", "入らない", "入って", "入った"],
  読む: ["読む", "読みます", "読まない", "読んで", "読んだ"],
  遊ぶ: ["遊ぶ", "遊びます", "遊ばない", "遊んで", "遊んだ"],
  死ぬ: ["死ぬ", "死にます", "死なない", "死んで", "死んだ"],
  書く: ["書く", "書きます", "書かない", "書いて", "書いた"],
  泳ぐ: ["泳ぐ", "泳ぎます", "泳がない", "泳いで", "泳いだ"],
  話す: ["話す", "話します", "話さない", "話して", "話した"],
  行く: ["行く", "行きます", "行かない", "行って", "行った"],
  食べる: ["食べる", "食べます", "食べない", "食べて", "食べた"],
  見る: ["見る", "見ます", "見ない", "見て", "見た"],
  起きる: ["起きる", "起きます", "起きない", "起きて", "起きた"],
  する: ["する", "します", "しない", "して", "した"],
  来る: ["来る", "来ます", "来ない", "来て", "来た"],
};

describe("verb forms", () => {
  it("makes every form in the table right", () => {
    for (const v of VERBS) {
      const dict = v.base + v.ending;
      expect(FORMS.map((f) => toPlain(conjugate(v, f))), dict).toEqual(EXPECTED[dict]);
    }
  });

  it("reads 来る as く, き and こ where it should", () => {
    const kuru = VERBS.find((v) => v.base === "来")!;
    expect(FORMS.map((f) => conjugate(kuru, f))).toEqual(["{来|く}る", "{来|き}ます", "{来|こ}ない", "{来|き}て", "{来|き}た"]);
  });

  it("gives the ます-stem", () => {
    expect(VERBS.map((v) => toPlain(stem(v))).slice(0, 3)).toEqual(["買い", "待ち", "入り"]);
    expect(toPlain(stem(VERBS.find((v) => v.ending === "する")!))).toBe("し");
  });

  it("puts furigana on every kanji in the written notes", () => {
    const texts = [
      ...GROUP_NOTES.map((g) => g.body),
      ...FORM_GUIDES.flatMap((g) => [g.use, ...g.rules]),
      ...VERBS.flatMap((v) => (v.note ? [v.note] : [])),
      ...VERBS.flatMap((v) => FORMS.map((f) => conjugate(v, f))),
    ];
    expect(texts.flatMap((t) => checkJa(t).map((p) => `${p} ← ${t}`))).toEqual([]);
  });
});
