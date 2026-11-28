import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { checkRun, MIN_RIGHT_MS } from "./check";
import { ALL_KANA, kanaFor } from "./kana/content";
import { kanaRules } from "./kana/rules";
import { KANA_SETUPS, parseSetup, setupKey } from "./kana/setups";
import { gameBySlug } from "./registry";
import { DEFAULT_SPEED } from "./score";
import type { GameRun } from "./types";

const NOW = new Date("2026-11-28T10:00:00Z");
const BASIC = kanaFor(ALL_KANA, ["hiragana"], ["basic"]);

function run(over: Partial<GameRun> = {}, cards = 20): GameRun {
  return {
    id: randomUUID(),
    game: "kana",
    setup: "read:hiragana:basic:20",
    playedAt: "2026-11-28T09:55:00.000Z",
    durationMs: 120_000,
    answers: BASIC.slice(0, cards).map((k, i) => ({ item: k.key, right: i % 4 !== 3, ms: 1000 + i * 100, given: k.romaji, tries: i % 4 !== 3 ? 1 : 2 })),
    ...over,
  };
}

const check = (r: GameRun) => checkRun(r, kanaRules.setup(r.setup), DEFAULT_SPEED, NOW);

describe("the server's score", () => {
  it("is worked out from the answers, whatever the device says", () => {
    const r = run();
    const checked = check(r);
    // 20 cards was a standard setup until a game played every kana picked; it saves, unranked.
    expect(checked).toMatchObject({ cards: 20, firstTryRight: 15, ranked: false, bestStreak: 3 });
    // 15 right; the first is 1.0 s (100 points), speed points fall from 1.5 s.
    const expected = Math.round(r.answers.reduce((s, a) => s + (a.right ? 70 + 30 * Math.min(1, Math.max(0, (5000 - a.ms) / 3500)) : 0), 0) / 20);
    expect(checked).toMatchObject({ score: expected });
    // Sending a score or a streak does nothing: the run has no field for them.
    expect(check({ ...r, score: 100, bestStreak: 20 } as GameRun)).toEqual(checked);
  });

  it("ranks only a standard setup played to the end", () => {
    expect(check(run({}, 12))).toMatchObject({ ranked: false, cards: 12 });
    const full = run({ setup: "read:hiragana:basic:46", durationMs: 400_000 }, 46);
    expect(check(full)).toMatchObject({ ranked: true });
    const stopped = run({ setup: "read:hiragana:basic:46", durationMs: 400_000 }, 30);
    expect(check(stopped)).toMatchObject({ ranked: false });
    const weakest = run({ setup: "read:weakest:5" }, 5);
    expect(check(weakest)).toMatchObject({ ranked: false });
  });
});

describe("the save checks", () => {
  it("turn away a setup the game doesn't know", () => {
    expect(check(run({ setup: "read:hiragana:basic:21" }))).toEqual({ error: "unknown setup" });
    expect(check(run({ setup: "read:basic:hiragana:20" }))).toEqual({ error: "unknown setup" });
    expect(check(run({ setup: "write:hiragana:basic:20" }))).toEqual({ error: "unknown setup" });
    expect(check(run({ setup: "read:weakest:21" }))).toEqual({ error: "unknown setup" });
  });

  it("turn away items that aren't in the setup's content", () => {
    const r = run();
    r.answers[0].item = "kana:katakana:a";
    expect(check(r)).toEqual({ error: "unknown item kana:katakana:a" });
    r.answers[0].item = "word:猫:ねこ";
    expect(check(r)).toMatchObject({ error: expect.stringMatching(/unknown item/) });
  });

  it("turn away more cards than the setup, or a card twice", () => {
    const r = run({}, 20);
    r.answers.push({ ...r.answers[0], item: BASIC[30].key });
    expect(check(r)).toEqual({ error: "more cards than the setup" });
    const twice = run({}, 20);
    twice.answers[5].item = twice.answers[4].item;
    expect(check(twice)).toMatchObject({ error: expect.stringMatching(/twice/) });
  });

  it("turn away impossible times", () => {
    const quick = run();
    quick.answers[0].ms = MIN_RIGHT_MS - 1;
    expect(check(quick)).toEqual({ error: "an answer quicker than possible" });
    // A quick miss is fine (Enter pressed by mistake).
    const slip = run();
    slip.answers[3].ms = 50;
    expect(check(slip)).toHaveProperty("score");
    expect(check(run({ durationMs: 10_000 }))).toEqual({ error: "answer times longer than the run" });
    expect(check(run({ playedAt: "2026-11-28T10:30:00.000Z" }))).toEqual({ error: "played at an unlikely time" });
    expect(check(run({ playedAt: "2026-08-01T10:00:00.000Z" }))).toEqual({ error: "played at an unlikely time" });
  });
});

describe("the kana setups", () => {
  it("rank three full decks of the basic kana per mode", () => {
    expect(KANA_SETUPS.map((s) => s.key)).toEqual([
      "read:hiragana:basic:46",
      "read:katakana:basic:46",
      "read:hiragana+katakana:basic:92",
      "find:hiragana:basic:46",
      "find:katakana:basic:46",
      "find:hiragana+katakana:basic:92",
    ]);
    expect(KANA_SETUPS[0].label).toBe("Read it · Hiragana · 46");
    for (const s of KANA_SETUPS) expect(kanaRules.setup(s.key), s.key).toMatchObject({ standard: true });
    expect(gameBySlug("kana")?.setups).toBe(KANA_SETUPS);
  });

  it("name what was played the same way every time", () => {
    expect(setupKey("find", ["katakana", "hiragana"], ["combo", "basic"], 50)).toBe("find:hiragana+katakana:basic+combo:50");
    expect(parseSetup("find:hiragana+katakana:basic+combo:50")).toMatchObject({ mode: "find", cards: 50 });
    expect(parseSetup("find:katakana+hiragana:basic:20")).toBeNull();
    expect(parseSetup("read:hiragana:basic:020")).toBeNull();
    // "All" of a small pool is the pool: dakuten hiragana has 25.
    expect(kanaRules.setup("read:hiragana:dakuten:25")).toMatchObject({ cards: 25, standard: false });
    expect(kanaRules.setup("read:hiragana:dakuten:20")).toMatchObject({ cards: 20 });
    expect(kanaRules.setup("read:hiragana:dakuten:24")).toBeNull();
  });
});
