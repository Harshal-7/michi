import { readFileSync } from "node:fs";

import type { Kana } from "@content/schema";
import { describe, expect, it } from "vitest";

import { answersFor, findOptions, isRightTyping, judgeTyped, rowOf } from "./answer";
import { answer, buildDeck, COME_BACK_AFTER, currentCard, isFinished, isRetry, kanaFor, startGame } from "./game";
import { progressOf, strengths, weakestFirst, weakKana, windowOf, type PastGame } from "./progress";
import { cardPoints, loggedMinutes, summarise } from "./score";
import type { GameKana } from "./types";

const content = JSON.parse(readFileSync(new URL("../../../content/generated/kana.json", import.meta.url), "utf8")) as Kana[];
const ALL: GameKana[] = content.map((k, i) => ({
  id: i + 1,
  kana: k.kana,
  romaji: k.romaji,
  accept: k.accept,
  lookalikes: k.lookalikes,
  script: k.script,
  group: k.group,
}));
const kana = (k: string) => ALL.find((x) => x.kana === k)!;

/** A small seeded random, so shuffles repeat. */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe("checking typed romaji", () => {
  it("takes Hepburn and each kana's other spellings", () => {
    expect(judgeTyped("shi", kana("し"))).toEqual({ verdict: "right", final: true });
    expect(judgeTyped("si", kana("し"))).toEqual({ verdict: "right", final: true });
    expect(judgeTyped("tu", kana("つ"))).toEqual({ verdict: "right", final: true });
    expect(judgeTyped("hu", kana("フ"))).toEqual({ verdict: "right", final: true });
    expect(judgeTyped("tya", kana("ちゃ"))).toEqual({ verdict: "right", final: true });
    expect(judgeTyped("o", kana("を"))).toEqual({ verdict: "right", final: true });
    expect(judgeTyped("wo", kana("を"))).toEqual({ verdict: "right", final: true });
  });

  it("reads past capitals, spaces and full-width letters", () => {
    expect(judgeTyped(" Ka ", kana("か")).verdict).toBe("right");
    expect(judgeTyped("ｋａ", kana("か")).verdict).toBe("right");
  });

  it("waits for a second n on ん before moving on", () => {
    expect(judgeTyped("n", kana("ん"))).toEqual({ verdict: "right", final: false });
    expect(judgeTyped("nn", kana("ん"))).toEqual({ verdict: "right", final: true });
  });

  it("keeps waiting while the letters are on the way to an answer", () => {
    expect(judgeTyped("", kana("し")).verdict).toBe("typing");
    expect(judgeTyped("s", kana("し")).verdict).toBe("typing");
    expect(judgeTyped("sh", kana("し")).verdict).toBe("typing");
    expect(judgeTyped("c", kana("ちゃ")).verdict).toBe("typing");
  });

  it("calls it wrong once a slip is as long as the answer", () => {
    expect(judgeTyped("g", kana("か")).verdict).toBe("typing");
    expect(judgeTyped("ga", kana("か")).verdict).toBe("wrong");
    expect(judgeTyped("o", kana("あ")).verdict).toBe("wrong");
    expect(judgeTyped("sx", kana("し")).verdict).toBe("typing");
    expect(judgeTyped("sxa", kana("し")).verdict).toBe("wrong");
  });

  it("checks what's typed when Enter is pressed", () => {
    expect(isRightTyping("chi", kana("ち"))).toBe(true);
    expect(isRightTyping("ch", kana("ち"))).toBe(false);
    expect(isRightTyping("", kana("ち"))).toBe(false);
  });

  it("lists every answer once", () => {
    expect(answersFor(kana("ん"))).toEqual(["n", "nn"]);
  });
});

describe("Find it options", () => {
  it("offers four kana of the same script, the answer once", () => {
    for (const target of ALL) {
      const { options, answerIndex } = findOptions(target, ALL, seeded(target.id));
      expect(options).toHaveLength(4);
      expect(options[answerIndex]).toBe(target);
      expect(new Set(options.map((o) => o.id)).size).toBe(4);
      expect(options.every((o) => o.script === target.script)).toBe(true);
    }
  });

  it("puts the look-alikes in", () => {
    const { options } = findOptions(kana("シ"), ALL, seeded(3));
    expect(options.map((o) => o.kana)).toEqual(expect.arrayContaining(["シ", "ツ", "ン"]));
    const wa = findOptions(kana("ワ"), ALL, seeded(4)).options.map((o) => o.kana);
    expect(wa.sort()).toEqual(["ウ", "ク", "フ", "ワ"].sort());
  });

  it("never offers a kana that sounds the same", () => {
    for (let seed = 1; seed < 40; seed++) {
      const ji = findOptions(kana("ぢ"), ALL, seeded(seed)).options.map((o) => o.kana);
      expect(ji).not.toContain("じ");
      const ti = findOptions(kana("ティ"), ALL, seeded(seed)).options.map((o) => o.kana);
      expect(ti).not.toContain("チ");
    }
  });

  it("fills up from the same row", () => {
    expect(rowOf(kana("し"))).toBe(rowOf(kana("さ")));
    expect(rowOf(kana("つ"))).toBe(rowOf(kana("た")));
    expect(rowOf(kana("きゃ"))).not.toBe(rowOf(kana("か")));
    const { options } = findOptions(kana("く"), ALL, seeded(9));
    expect(options.filter((o) => rowOf(o) === rowOf(kana("く"))).length).toBeGreaterThanOrEqual(3);
  });
});

describe("the deck", () => {
  it("picks by script and group", () => {
    expect(kanaFor(ALL, ["hiragana"], ["basic"])).toHaveLength(46);
    expect(kanaFor(ALL, ["hiragana"], ["basic", "dakuten", "combo", "extended"])).toHaveLength(104);
    expect(kanaFor(ALL, ["katakana"], ["extended"])).toHaveLength(20);
    expect(kanaFor(ALL, ["hiragana", "katakana"], ["basic"])).toHaveLength(92);
  });

  it("shuffles and cuts it to length", () => {
    const pool = kanaFor(ALL, ["hiragana"], ["basic"]);
    const deck = buildDeck(pool, 20, seeded(2));
    expect(deck).toHaveLength(20);
    expect(new Set(deck).size).toBe(20);
    expect(buildDeck(pool, 0, seeded(2))).toHaveLength(46);
    expect(buildDeck(pool, 50, seeded(2))).toHaveLength(46);
  });
});

describe("a game's turns", () => {
  it("moves on after a right answer and finishes when every card is right", () => {
    let g = startGame(3);
    g = answer(g, { right: true, ms: 1000, given: "ka" });
    g = answer(g, { right: true, ms: 1000, given: "ki" });
    expect(currentCard(g)).toBe(2);
    g = answer(g, { right: true, ms: 1000, given: "ku" });
    expect(isFinished(g)).toBe(true);
    expect(g.bestStreak).toBe(3);
    expect(g.points).toBe(300);
  });

  it("sends a miss back a few cards, and only first tries count", () => {
    let g = startGame(6);
    g = answer(g, { right: false, ms: 2000, given: "ko" });
    expect(g.queue).toEqual([1, 2, 3, 0, 4, 5]);
    expect(g.streak).toBe(0);
    for (let i = 0; i < COME_BACK_AFTER; i++) g = answer(g, { right: true, ms: 1000, given: "x" });
    expect(currentCard(g)).toBe(0);
    expect(isRetry(g)).toBe(true);
    g = answer(g, { right: true, ms: 800, given: "ka" });
    expect(g.first[0]).toEqual({ right: false, ms: 2000, given: "ko" });
    expect(g.tries[0]).toBe(2);
    // The retry doesn't add points or lengthen the run.
    expect(g.points).toBe(300);
    expect(g.streak).toBe(3);
  });

  it("puts a miss last when few are left", () => {
    let g = startGame(2);
    g = answer(g, { right: false, ms: 2000, given: "" });
    expect(g.queue).toEqual([1, 0]);
  });
});

describe("scoring", () => {
  it("gives 70 for right and up to 30 for speed", () => {
    expect(cardPoints(true, 900)).toBe(100);
    expect(cardPoints(true, 1500)).toBe(100);
    expect(cardPoints(true, 3250)).toBe(85);
    expect(cardPoints(true, 5000)).toBe(70);
    expect(cardPoints(true, 12000)).toBe(70);
    expect(cardPoints(false, 500)).toBe(0);
  });

  it("averages a game to a score out of 100", () => {
    const s = summarise([
      { right: true, ms: 1000 },
      { right: true, ms: 3000 },
      { right: false, ms: 1500 },
      { right: true, ms: 5000 },
    ]);
    expect(s).toEqual({ cards: 4, firstTryRight: 3, score: Math.round((100 + (70 + 30 * (2000 / 3500)) + 0 + 70) / 4), meanMs: 3000 });
    expect(summarise([{ right: false, ms: 900 }])).toEqual({ cards: 1, firstTryRight: 0, score: 0, meanMs: null });
  });

  it("logs whole minutes, none under half a minute", () => {
    expect(loggedMinutes(20_000)).toBe(0);
    expect(loggedMinutes(30_000)).toBe(1);
    expect(loggedMinutes(150_000)).toBe(3);
  });
});

describe("progress over time", () => {
  const game = (score: number, cards: number, right: number, meanMs: number | null, day: number): PastGame => ({
    playedAt: `2026-11-${String(day).padStart(2, "0")}T10:00:00.000Z`,
    score,
    cards,
    firstTryRight: right,
    meanMs,
  });

  it("finds the best and last games and charts the recent ones oldest first", () => {
    const games = [game(80, 20, 18, 1400, 28), game(91, 20, 19, 1100, 27), game(60, 20, 14, 2600, 26)];
    const p = progressOf(games);
    expect(p.best?.score).toBe(91);
    expect(p.last?.score).toBe(80);
    expect(p.chart.map((g) => g.score)).toEqual([60, 91, 80]);
    expect(p.before).toBeNull();
  });

  it("compares the last five games with the five before, weighting by cards", () => {
    const recent = [game(90, 20, 19, 1000, 20), game(90, 50, 45, 1600, 19), ...[18, 17, 16].map((d) => game(90, 20, 18, 1300, d))];
    const before = [15, 14, 13, 12, 11].map((d) => game(70, 20, 14, 2500, d));
    const p = progressOf([...recent, ...before]);
    expect(p.recent).toEqual({ accuracy: Math.round(((19 + 45 + 54) / 130) * 100), meanMs: Math.round((19 * 1000 + 45 * 1600 + 54 * 1300) / 118), games: 5 });
    expect(p.before).toEqual({ accuracy: 70, meanMs: 2500, games: 5 });
    expect(windowOf([])).toBeNull();
    expect(windowOf([game(0, 20, 0, null, 1)])).toEqual({ accuracy: 0, meanMs: null, games: 1 });
  });

  it("rates each kana by its last ten answers and finds the weakest", () => {
    const answers = [
      // Newest first. Kana 1: always right and quick. Kana 2: missed twice. Kana 3: right but slow.
      ...Array.from({ length: 12 }, () => ({ itemId: 1, right: true, ms: 900 })),
      { itemId: 2, right: false, ms: 2000 },
      { itemId: 2, right: true, ms: 1200 },
      { itemId: 2, right: false, ms: 3000 },
      { itemId: 3, right: true, ms: 5000 },
      { itemId: 3, right: true, ms: 5000 },
    ];
    const list = strengths(answers);
    const one = list.find((s) => s.itemId === 1)!;
    expect(one).toEqual({ itemId: 1, strength: 100, seen: 10, right: 10 });
    expect(list.find((s) => s.itemId === 2)).toEqual({ itemId: 2, strength: 33, seen: 3, right: 1 });
    expect(weakestFirst(list).map((s) => s.itemId)).toEqual([2, 3, 1]);
    expect(weakKana(list).map((s) => s.itemId)).toEqual([2, 3]);
  });

  it("puts the one missed more first when two rate the same", () => {
    const list = [
      { itemId: 5, strength: 50, seen: 2, right: 1 },
      { itemId: 6, strength: 50, seen: 4, right: 1 },
    ];
    expect(weakestFirst(list).map((s) => s.itemId)).toEqual([6, 5]);
  });
});
