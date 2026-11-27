import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Db } from "@/db/client";
import { activityLogs, cards, items, kanaGames, reviewLogs } from "@/db/schema";
import { createTestDb } from "@/db/test/test-db";

import { loadAnswers, loadGameKana, loadGames, SavedGame, saveGame } from "./data";

let db: Db;
let drop: () => Promise<void>;
let ids: number[] = [];

beforeAll(async () => {
  ({ db, drop } = await createTestDb());
  const rows = await db
    .insert(items)
    .values([
      { kind: "kana", term: "し", reading: "shi", source: "starter", dedupeKey: "し", data: { script: "hiragana", group: "basic", accept: ["si"], lookalikes: [] } },
      { kind: "kana", term: "ツ", reading: "tsu", source: "starter", dedupeKey: "ツ", data: { script: "katakana", group: "basic", accept: ["tu"], lookalikes: ["シ"] } },
      { kind: "kana", term: "ぎゃ", reading: "gya", source: "starter", dedupeKey: "ぎゃ", data: { script: "hiragana", group: "combo", accept: [], lookalikes: [] } },
      { kind: "word", term: "猫", reading: "ねこ", meaning: "cat", source: "starter", dedupeKey: "猫" },
    ])
    .returning({ id: items.id });
  ids = rows.map((r) => r.id);
  await db.insert(cards).values(ids.map((itemId) => ({ itemId, cardType: "recognition" as const })));
});
afterAll(() => drop?.());

const game = (over: Partial<SavedGame> = {}): SavedGame => ({
  id: randomUUID(),
  mode: "read",
  weakest: false,
  scripts: ["hiragana", "katakana"],
  groups: ["basic", "combo"],
  playedAt: "2026-11-28T03:00:00.000Z",
  durationMs: 95_000,
  bestStreak: 2,
  answers: [
    { itemId: ids[0], right: true, ms: 1000, given: "shi", tries: 1 },
    { itemId: ids[1], right: false, ms: 2500, given: "so", tries: 2 },
    { itemId: ids[2], right: true, ms: 1500, given: "gya", tries: 1 },
  ],
  ...over,
});

describe("the kana game's data", () => {
  it("loads the kana with their script, group and spellings, and nothing else", async () => {
    const kana = await loadGameKana(db);
    expect(kana.map((k) => k.kana)).toEqual(["し", "ツ", "ぎゃ"]);
    expect(kana[1]).toMatchObject({ romaji: "tsu", accept: ["tu"], lookalikes: ["シ"], script: "katakana", group: "basic" });
  });

  it("saves a game once, with its answers and its minutes as auto study time", async () => {
    const g = game();
    expect(await saveGame(db, g)).toEqual({ saved: true });
    expect(await saveGame(db, g)).toEqual({ saved: false });
    const [row] = await db.select().from(kanaGames);
    expect(row).toMatchObject({ cards: 3, firstTryRight: 2, score: 67, meanMs: 1250, bestStreak: 2, studyDate: "2026-11-28" });
    const logs = await db.select().from(activityLogs);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ studyDate: "2026-11-28", kind: "study", skill: "general", minutes: 2, auto: true });
  });

  it("leaves the review schedule alone", async () => {
    const [state] = await db.select({ n: sql<number>`count(*)::int` }).from(reviewLogs);
    expect(state.n).toBe(0);
    const touched = await db.select({ state: cards.state, reps: cards.reps }).from(cards);
    expect(touched.every((c) => c.state === "new" && c.reps === 0)).toBe(true);
  });

  it("logs no minutes for a game under half a minute", async () => {
    await db.execute(sql`truncate activity_logs restart identity`);
    await saveGame(db, game({ durationMs: 20_000 }));
    expect(await db.select().from(activityLogs)).toHaveLength(0);
  });

  it("dates a game played at 2 am to the evening before", async () => {
    const id = randomUUID();
    await saveGame(db, game({ id, playedAt: "2026-11-27T20:30:00.000Z" }));
    const [row] = await db.select({ studyDate: kanaGames.studyDate }).from(kanaGames).where(sql`${kanaGames.id} = ${id}`);
    expect(row.studyDate).toBe("2026-11-27");
  });

  it("lists past games newest first and each kana's recent answers by mode", async () => {
    await saveGame(db, game({ mode: "find", playedAt: "2026-11-28T05:00:00.000Z" }));
    const read = await loadGames(db, "read");
    expect(read.map((g) => g.playedAt)).toEqual(["2026-11-28T03:00:00.000Z", "2026-11-28T03:00:00.000Z", "2026-11-27T20:30:00.000Z"]);
    expect(await loadGames(db, "find")).toHaveLength(1);
    const answers = await loadAnswers(db, "read", 2);
    expect(answers.filter((a) => a.itemId === ids[0])).toHaveLength(2);
    expect(answers.every((a) => typeof a.right === "boolean" && typeof a.ms === "number")).toBe(true);
  });

  it("turns away a game that doesn't check out", () => {
    expect(SavedGame.safeParse(game({ answers: [] })).success).toBe(false);
    expect(SavedGame.safeParse({ ...game(), mode: "write" }).success).toBe(false);
    expect(SavedGame.safeParse({ ...game(), id: "abc" }).success).toBe(false);
  });
});
