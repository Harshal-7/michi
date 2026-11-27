import { readFileSync } from "node:fs";

import { blanks, type Grammar, type Kana, type Kanji, toPlain, type Word } from "@content/schema";
import { describe, expect, it } from "vitest";

import { grammarItem, kanaItem, kanjiItem, wordItem } from "@/db/seed/starter";

import { toGrammar, toKana, toKanji, toWord } from "./bank";
import {
  type Bank,
  chunkSentence,
  grammarFillQuestion,
  kanaQuestion,
  kanjiReadingQuestion,
  listeningQuestion,
  markInSentence,
  meaningQuestion,
  meaningReverseQuestion,
  type QWord,
  sentenceOrderQuestion,
  sharesGloss,
  spellingQuestion,
  wordInContextQuestion,
} from "./builders";
import { compose, slotsFor } from "./compose";
import { readingVariants, toHiragana } from "./kana-text";
import { seeded } from "./random";
import { Asked } from "./types";

const load = <T>(name: string) => JSON.parse(readFileSync(new URL(`../../../content/generated/${name}.json`, import.meta.url), "utf8")) as T[];

let nextId = 1;
const row = (item: { kind: "kana" | "kanji" | "word" | "grammar" | "phrase"; level: string; term: string; reading: string | null; meaning: string; data: unknown }) => ({
  id: nextId++,
  ...item,
});
const words = load<Word>("words").filter((w) => w.level === "N5").map((w) => toWord(row(wordItem(w)))!);
const kanji = load<Kanji>("kanji").filter((k) => k.level === "N5").map((k) => toKanji(row(kanjiItem(k)))!);
const kana = load<Kana>("kana").map((k) => toKana(row(kanaItem(k)))!);
const grammar = load<Grammar>("grammar").filter((g) => g.level === "N5").map((g) => toGrammar(row(grammarItem(g)))!);
const bank: Bank = { words, kanji, kana, grammar };

/** The plan's checks for every question: 4 different options, the answer among them. */
function expectFair(asked: Asked | null): asserts asked is Asked {
  expect(asked).not.toBeNull();
  expect(Asked.safeParse(asked).success).toBe(true);
  expect(new Set(asked!.options.map(toPlain)).size).toBe(4);
}

const byTerm = (term: string) => words.find((w) => w.term === term)!;

describe("kana tools", () => {
  it("changes a reading by one small step", () => {
    const v = readingVariants("らいしゅう");
    expect(v).toContain("らいしゅ"); // long vowel dropped
    expect(v).toContain("らいしう"); // small ゅ dropped
    expect(v).not.toContain("らいしゅう");
    expect(readingVariants("がっこう")).toEqual(expect.arrayContaining(["がこう", "かっこう", "がっこ"]));
  });

  it("turns katakana readings into hiragana", () => {
    expect(toHiragana("ライ")).toBe("らい");
  });
});

describe("sentence tools", () => {
  it("underlines a word and drops its furigana", () => {
    expect(markInSentence("{来週|らいしゅう}また{会|あ}いたい。", "来週", (f) => `⟨${f}⟩`)).toBe("⟨来週⟩また{会|あ}いたい。");
    expect(markInSentence("もっと{果物|くだもの}を{食|た}べるべきです。", "食べる", (f) => `[[${f}]]`)).toBe("もっと{果物|くだもの}を[[食べる]]べきです。");
    expect(markInSentence("{雨|あめ}です。", "雪", (f) => f)).toBeNull();
  });

  it("splits a sentence into word-sized chunks", () => {
    expect(chunkSentence("{毎朝|まいあさ}バス[[で]]{会社|かいしゃ}へ{行|い}きます。")).toEqual({
      chunks: ["{毎朝|まいあさ}", "バスで", "{会社|かいしゃ}へ", "{行|い}きます"],
      end: "。",
    });
    expect(chunkSentence("あの{人|ひと}は{木村|きむら}さんのお{兄|にい}さんだよ。").chunks).toEqual(["あの", "{人|ひと}は", "{木村|きむら}さんの", "お{兄|にい}さんだよ"]);
  });
});

describe("question builders", () => {
  const random = seeded(7);

  it("asks a kanji reading with small changes to the reading", () => {
    const asked = kanjiReadingQuestion(byTerm("来週"), bank, random);
    expectFair(asked);
    expect(asked.options[asked.answer]).toBe("らいしゅう");
    expect(asked.ja).toContain("⟨来週⟩");
    for (const o of asked.options) expect(o).toMatch(/^[ぁ-ゟ]+$/);
  });

  it("asks a spelling with the meaning, never offering a same-meaning homophone", () => {
    const asked = spellingQuestion(byTerm("来週"), bank, random);
    expectFair(asked);
    expect(asked.options[asked.answer]).toBe("来週");
    expect(asked.en).toBe("next week");
  });

  it("never offers a meaning that shares a gloss word with the answer", () => {
    for (const w of words.slice(0, 200)) {
      const asked = meaningQuestion(w, bank, random);
      if (!asked) continue;
      expectFair(asked);
      const right = asked.options[asked.answer];
      for (const [i, o] of asked.options.entries()) if (i !== asked.answer) expect(sharesGloss(o, right)).toBe(false);
    }
  });

  it("never offers a listening option that sounds like the word", () => {
    for (const w of words.slice(0, 300)) {
      const asked = listeningQuestion(w, bank, random);
      if (!asked) continue;
      expectFair(asked);
      const heard = asked.say!;
      for (const [i, o] of asked.options.entries()) {
        if (i === asked.answer) continue;
        const sounds = words.filter((x) => x.term === o).map((x) => toHiragana(x.reading));
        expect(sounds).not.toContain(heard);
      }
    }
  });

  it("builds a fair question of every type for most of the N5 content", () => {
    const counts: Record<string, number> = {};
    const tally = (type: string, asked: Asked | null) => {
      if (!asked) return;
      expectFair(asked);
      counts[type] = (counts[type] ?? 0) + 1;
    };
    for (const k of kana) tally("kana", kanaQuestion(k, bank, random));
    for (const w of words) {
      tally("kanji_reading", kanjiReadingQuestion(w, bank, random));
      tally("spelling", spellingQuestion(w, bank, random));
      tally("meaning_reverse", meaningReverseQuestion(w, bank, random));
      tally("word_in_context", wordInContextQuestion(w, bank, random));
    }
    for (const k of kanji) tally("meaning", meaningQuestion(k, bank, random));
    for (const g of grammar) {
      tally("grammar_fill", grammarFillQuestion(g, bank, random));
      for (const e of g.examples) tally("sentence_order", sentenceOrderQuestion(e, random));
    }
    expect(counts.kana).toBe(kana.length);
    expect(counts.kanji_reading).toBeGreaterThan(300);
    expect(counts.spelling).toBeGreaterThan(200);
    expect(counts.meaning_reverse).toBeGreaterThan(650);
    expect(counts.word_in_context).toBeGreaterThan(150);
    expect(counts.meaning).toBe(kanji.length);
    expect(counts.grammar_fill).toBe(grammar.length);
    expect(counts.sentence_order).toBeGreaterThan(80);
  }, 30_000);

  it("puts a checked sentence's blank and the point's wrong options into its fill-in", () => {
    const te = grammar.find((g) => g.pattern.includes("てください"))!;
    const point = { ...te, questions: [], examples: [], sentences: [{ ja: "ゆっくり{話|はな}し[[てください]]。", en: "Please speak slowly." }] };
    const asked = grammarFillQuestion(point, bank, random);
    expectFair(asked);
    expect(asked.options[asked.answer]).toBe("てください");
    expect(blanks(asked.ja!)).toEqual(["てください"]);
  });

  it("keeps the predicate last in sentence order and stars the third slot", () => {
    const asked = sentenceOrderQuestion({ ja: "{毎朝|まいあさ}バス[[で]]{会社|かいしゃ}へ{行|い}きます。", en: "I go to work by bus every morning." }, random);
    expectFair(asked);
    expect(asked.options[asked.answer]).toBe("{会社|かいしゃ}へ");
    expect(asked.order).toEqual({ before: "", after: "。", star: 2 });
  });
});

describe("sentence order's star", () => {
  it("goes where the order is fixed when it can", async () => {
    const { starSlot } = await import("./builders");
    expect(starSlot(["{兄|あに}の", "{車|くるま}で", "{会社|かいしゃ}へ", "{行|い}きます"])).toBe(0);
    expect(starSlot(["{図書館|としょかん}で", "{大|おお}きい", "{声|こえ}で", "{話|はな}しません"])).toBe(1);
    expect(starSlot(["{毎朝|まいあさ}", "バスで", "{会社|かいしゃ}へ", "{行|い}きます"])).toBe(2);
  });
});

describe("compose", () => {
  const weighted = <T>(list: T[]) => list.map((item) => ({ item, weight: 1 }));

  it("makes a 10-question daily quiz and a 25-question weekly test", () => {
    const pool = { words: weighted(words.slice(0, 120)), kanji: weighted(kanji.slice(0, 30)), grammar: weighted(grammar.slice(0, 20)), kana: weighted(kana) };
    const daily = compose({ kind: "daily", pool, bank, kanaPhase: true, hasVoice: true, random: seeded(1) });
    expect(daily.map((b) => b.asked.type)).toEqual([
      "kana",
      "kanji_reading",
      "kanji_reading",
      "meaning",
      "meaning_reverse",
      "grammar_fill",
      "grammar_fill",
      expect.stringMatching(/spelling|word_in_context/),
      "sentence_order",
      "listening",
    ]);
    expect(new Set(daily.map((b) => b.itemId)).size).toBe(10);
    const weekly = compose({ kind: "weekly", pool, bank, kanaPhase: true, hasVoice: true, random: seeded(2) });
    expect(weekly).toHaveLength(25);
    expect(slotsFor("weekly", true)).toHaveLength(25);
  });

  it("fills with kana while the pool is small (decision 2)", () => {
    const pool = { words: [], kanji: [], grammar: [], kana: weighted(kana) };
    const daily = compose({ kind: "daily", pool, bank, kanaPhase: true, hasVoice: true, random: seeded(3) });
    expect(daily).toHaveLength(10);
    expect(daily.every((b) => b.asked.type === "kana")).toBe(true);
  });

  it("asks a meaning instead of listening on a device with no Japanese voice (decision 3)", () => {
    const pool = { words: weighted(words.slice(0, 50) as QWord[]), kanji: [], grammar: [], kana: weighted(kana) };
    const daily = compose({ kind: "daily", pool, bank, kanaPhase: true, hasVoice: false, random: seeded(4) });
    expect(daily.some((b) => b.asked.type === "listening")).toBe(false);
    expect(daily.at(-1)?.asked.type).toBe("meaning");
  });
});
