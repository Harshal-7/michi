import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ALL_KANA, kanaFor } from "@/lib/games/kana/content";
import { boardSince, boardView } from "@/lib/games/leaderboard";
import { saveRun } from "@/lib/games/save";
import type { GameRun } from "@/lib/games/types";

import type { Db } from "./client";
import { createGuest, deleteGuest, loadBoard, loadItemAnswers, loadRuns, loadSummary, ownerPlayer, type Player, setGuestHidden, takenNameKeys } from "./play";
import { activityLogs, gameAnswers, gameRuns, items, kanaGameAnswers, kanaGames, players, reviewLogs } from "./schema";
import { createTestDb } from "./test/test-db";

let db: Db;
let drop: () => Promise<void>;
let owner: Player;
beforeAll(async () => {
  ({ db, drop } = await createTestDb());
  owner = await ownerPlayer(db);
});
afterAll(() => drop?.());
beforeEach(() => db.execute(sql`truncate game_runs cascade; truncate activity_logs; delete from players where not is_owner`));

const BASIC = kanaFor(ALL_KANA, ["hiragana"], ["basic"]);
const guest = async (name: string) => (await createGuest(db, name, name.toLowerCase(), "scrypt:x"))!;

/** The ranked Read it board: every basic hiragana. */
const READ = "read:hiragana:basic:46";
const FIND = "find:hiragana:basic:46";

/** A full 46-card Read it run; `right` cards right first time at 1 s each (100 points each, the rest 0). */
function run(playedAt: string, right = 46, over: Partial<GameRun> = {}): GameRun {
  return {
    id: randomUUID(),
    game: "kana",
    setup: READ,
    playedAt,
    durationMs: 95_000,
    answers: BASIC.map((k, i) => ({ item: k.key, right: i < right, ms: 1000, given: k.romaji, tries: i < right ? 1 : 2 })),
    ...over,
  };
}

const NOW = new Date("2026-12-02T06:00:00Z");

describe("saving a run", () => {
  it("is the migration's owner row, Harshal, with no PIN", async () => {
    expect(owner).toMatchObject({ name: "Harshal", isOwner: true });
    const [row] = await db.select().from(players).where(eq(players.isOwner, true));
    expect(row.pinHash).toBeNull();
    expect((await ownerPlayer(db)).id).toBe(owner.id);
  });

  it("stores it once, scored on the server, with Harshal's minutes as study time", async () => {
    const r = run("2026-12-02T05:00:00.000Z", 37);
    expect(await saveRun(db, owner, r, NOW)).toEqual({ ok: true, saved: true, ranked: true, score: 80 });
    expect(await saveRun(db, owner, r, NOW)).toEqual({ ok: true, saved: false, ranked: true, score: 80 });
    const [row] = await db.select().from(gameRuns);
    expect(row).toMatchObject({ playerId: owner.id, game: "kana", cards: 46, firstTryRight: 37, score: 80, bestStreak: 37, meanMs: 1000, studyDate: "2026-12-02" });
    expect(await db.select().from(gameAnswers)).toHaveLength(46);
    const logs = await db.select().from(activityLogs);
    expect(logs).toEqual([expect.objectContaining({ kind: "study", skill: "general", minutes: 2, auto: true, note: "Kana game", studyDate: "2026-12-02" })]);
  });

  it("logs no minutes for a guest, and never touches reviews", async () => {
    const aki = await guest("Aki");
    expect(await saveRun(db, aki, run("2026-12-02T05:00:00.000Z"), NOW)).toMatchObject({ ok: true, saved: true });
    expect(await db.select().from(activityLogs)).toHaveLength(0);
    expect(await db.select().from(reviewLogs)).toHaveLength(0);
  });

  it("turns away a run that doesn't check out, and saves nothing", async () => {
    expect(await saveRun(db, owner, { ...run("2026-12-02T05:00:00.000Z"), game: "chess" }, NOW)).toEqual({ ok: false, error: "unknown game" });
    expect(await saveRun(db, owner, { nope: true }, NOW)).toEqual({ ok: false, error: "not a run" });
    const bad = run("2026-12-02T05:00:00.000Z");
    bad.answers[0].ms = 10;
    expect(await saveRun(db, owner, bad, NOW)).toMatchObject({ ok: false });
    expect(await db.select().from(gameRuns)).toHaveLength(0);
  });

  it("gives back a player's runs and recent answers per mode", async () => {
    await saveRun(db, owner, run("2026-12-01T05:00:00.000Z", 23), NOW);
    await saveRun(db, owner, run("2026-12-02T05:00:00.000Z"), NOW);
    await saveRun(db, owner, run("2026-12-02T05:30:00.000Z", 46, { setup: FIND }), NOW);
    await saveRun(db, await guest("Aki"), run("2026-12-02T05:00:00.000Z"), NOW);
    const runs = await loadRuns(db, owner.id, "kana");
    expect(runs.map((r) => [r.setup.split(":")[0], r.score])).toEqual([["find", 100], ["read", 100], ["read", 50]]);
    const answers = await loadItemAnswers(db, owner.id, "kana", 1);
    expect(answers.filter((a) => a.mode === "read")).toHaveLength(46);
    expect(answers.find((a) => a.mode === "read" && a.item === BASIC[15].key)).toMatchObject({ right: true });
  });
});

describe("leaderboards", () => {
  it("rank each player's best, ties to the quicker, and leave out hidden names and unranked runs", async () => {
    const [aki, mei, ken] = [await guest("Aki"), await guest("Mei"), await guest("Ken")];
    await saveRun(db, aki, run("2026-12-01T05:00:00.000Z", 23), NOW);
    await saveRun(db, aki, run("2026-12-01T06:00:00.000Z", 41), NOW);
    await saveRun(db, mei, run("2026-12-01T05:00:00.000Z", 41, { answers: run("", 41).answers.map((a) => ({ ...a, ms: 1600 })) }), NOW);
    await saveRun(db, owner, run("2026-12-01T05:00:00.000Z"), NOW);
    await saveRun(db, ken, run("2026-12-01T05:00:00.000Z"), NOW);
    await saveRun(db, aki, run("2026-12-01T07:00:00.000Z", 20, { setup: "read:weakest:20", answers: run("").answers.slice(0, 20) }), NOW);
    await setGuestHidden(db, "ken", true);
    const rows = await loadBoard(db, "kana", READ, null);
    expect(rows.map((r) => [r.name, r.score])).toEqual([["Harshal", 100], ["Aki", 89], ["Mei", 88]]);
    const view = boardView(rows, mei.id, 2);
    expect(view.top.map((p) => [p.place, p.name, p.you])).toEqual([[1, "Harshal", false], [2, "Aki", false]]);
    expect(view.me).toMatchObject({ place: 3, name: "Mei", you: true });
    expect(view.players).toBe(3);
    expect(boardView(rows, aki.id).me).toBeNull();
    expect(JSON.stringify(view)).not.toContain(mei.id);
  });

  it("start the week on Monday at 4 am IST", async () => {
    const [sun, late, mon] = [await guest("Sunday"), await guest("Late"), await guest("Monday")];
    // Sunday 29 Nov 11 pm IST, and Monday 30 Nov 3:30 am IST (still Sunday's study day).
    await saveRun(db, sun, run("2026-11-29T17:30:00.000Z"), NOW);
    await saveRun(db, late, run("2026-11-29T22:00:00.000Z", 45), NOW);
    // Monday 30 Nov 4:00 am IST: this week.
    await saveRun(db, mon, run("2026-11-29T22:30:00.000Z", 23), NOW);
    expect(boardSince("week", NOW)).toBe("2026-11-30");
    expect(boardSince("all", NOW)).toBeNull();
    const week = await loadBoard(db, "kana", READ, boardSince("week", NOW));
    expect(week.map((r) => r.name)).toEqual(["Monday"]);
    const all = await loadBoard(db, "kana", READ, null);
    expect(all.map((r) => r.name)).toEqual(["Sunday", "Late", "Monday"]);
    // Sunday 6 Dec 11:59 pm IST is still this week; Monday 7 Dec 4 am is the next.
    expect(boardSince("week", new Date("2026-12-06T18:29:00Z"))).toBe("2026-11-30");
    expect(boardSince("week", new Date("2026-12-06T22:29:00Z"))).toBe("2026-11-30");
    expect(boardSince("week", new Date("2026-12-06T22:30:00Z"))).toBe("2026-12-07");
  });

  it("forget a guest who deletes their name", async () => {
    const aki = await guest("Aki");
    await saveRun(db, aki, run("2026-12-01T05:00:00.000Z"), NOW);
    await deleteGuest(db, aki.id);
    await deleteGuest(db, owner.id);
    expect(await db.select().from(gameRuns)).toHaveLength(0);
    expect(await ownerPlayer(db)).toMatchObject({ id: owner.id });
  });
});

describe("a player's summary and names", () => {
  it("counts their runs and keeps the best of each game with its setup", async () => {
    const mei = await guest("Mei");
    expect(await loadSummary(db, mei.id)).toMatchObject({ runs: 0, bests: [] });
    await saveRun(db, mei, run("2026-12-02T05:00:00.000Z", 23), NOW);
    await saveRun(db, mei, run("2026-12-02T05:10:00.000Z", 41, { setup: FIND }), NOW);
    await saveRun(db, mei, run("2026-12-02T05:20:00.000Z", 30), NOW);
    const summary = await loadSummary(db, mei.id);
    expect(summary.runs).toBe(3);
    expect(summary.bests).toEqual([{ game: "kana", setup: FIND, score: 89 }]);
    expect(Date.parse(summary.since)).not.toBeNaN();
  });

  it("says which name keys are taken", async () => {
    await guest("Aki");
    expect(await takenNameKeys(db, ["aki", "aki2", "harshal"])).toEqual(new Set(["aki", "harshal"]));
    expect(await takenNameKeys(db, [])).toEqual(new Set());
  });

  it("puts each place's right-first-time count on the board", async () => {
    const aki = await guest("Aki");
    await saveRun(db, aki, run("2026-12-02T05:00:00.000Z", 44), NOW);
    const [row] = await loadBoard(db, "kana", READ, null);
    expect(row).toMatchObject({ name: "Aki", cards: 46, firstTryRight: 44, score: 96 });
  });
});

describe("the migration's copy of Harshal's kana games", () => {
  it("moves each game and its answers to the owner, by content slug, ranked when it's a standard setup", async () => {
    const fresh = await createTestDb();
    try {
      const t = fresh.db;
      const kana = await t
        .insert(items)
        .values([
          { kind: "kana", term: "あ", reading: "a", source: "starter", dedupeKey: "あ", seedSlug: "kana:hiragana:a" },
          { kind: "kana", term: "い", reading: "i", source: "starter", dedupeKey: "い", seedSlug: "kana:hiragana:i" },
        ])
        .returning({ id: items.id });
      const game = (id: string, weakest: boolean, cards: number) => ({
        id,
        mode: "read" as const,
        weakest,
        scripts: ["hiragana"],
        groups: ["basic"],
        playedAt: new Date("2026-11-28T03:00:00Z"),
        studyDate: "2026-11-28",
        cards,
        firstTryRight: 1,
        score: 50,
        bestStreak: 1,
        meanMs: 1200,
        durationMs: 60_000,
      });
      const [a, b, c] = [randomUUID(), randomUUID(), randomUUID()];
      await t.insert(kanaGames).values([game(a, false, 20), game(b, true, 2), game(c, false, 2)]);
      await t.insert(kanaGameAnswers).values([
        { gameId: a, itemId: kana[0].id, position: 0, right: true, ms: 1200, given: "a", tries: 1 },
        { gameId: a, itemId: kana[1].id, position: 1, right: false, ms: 3000, given: "e", tries: 2 },
      ]);
      // The migration's own statements, after its tables exist: the owner row and the two copies.
      await t.execute(sql`truncate players cascade`);
      const statements = readFileSync(new URL("../../drizzle/0004_play.sql", import.meta.url), "utf8")
        .split("--> statement-breakpoint")
        .filter((s) => /^\s*(--.*\n)*\s*INSERT/m.test(s));
      expect(statements).toHaveLength(3);
      for (const s of statements) await t.$client.query(s);
      const [me] = await t.select().from(players);
      expect(me).toMatchObject({ name: "Harshal", nameKey: "harshal", isOwner: true, pinHash: null });
      const runs = await t.select().from(gameRuns).orderBy(gameRuns.setup);
      expect(runs.map((r) => [r.id, r.setup, r.ranked, r.playerId === me.id, r.score])).toEqual(
        [
          [c, "read:hiragana:basic:2", false, true, 50],
          [a, "read:hiragana:basic:20", true, true, 50],
          [b, "read:weakest:2", false, true, 50],
        ],
      );
      const answers = await t.select().from(gameAnswers).orderBy(gameAnswers.position);
      expect(answers.map((x) => [x.runId, x.item, x.right, x.tries])).toEqual([
        [a, "kana:hiragana:a", true, 1],
        [a, "kana:hiragana:i", false, 2],
      ]);
      // The old tables stay for now (decision G).
      expect(await t.select().from(kanaGames)).toHaveLength(3);
    } finally {
      await fresh.drop();
    }
  });
});
