/**
 * The kana game's database side: the kana it asks, past games and answers for the start
 * screen, and saving a finished game with its minutes. Nothing here touches cards or reviews.
 */
import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import type { DbOrTx } from "@/db/client";
import { activityLogs, items, kanaGameAnswers, kanaGames } from "@/db/schema";
import { studyDate } from "@/lib/day";

import type { KanaAnswer, PastGame } from "./progress";
import { loggedMinutes, summarise } from "./score";
import { GROUPS, type GameKana, type Group, MODES, type Mode, SCRIPTS } from "./types";

/** Every kana item, in content order. */
export async function loadGameKana(db: DbOrTx): Promise<GameKana[]> {
  const rows = await db
    .select({ id: items.id, kana: items.term, romaji: items.reading, data: items.data })
    .from(items)
    .where(eq(items.kind, "kana"))
    .orderBy(asc(items.id));
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);
  return rows.flatMap((r): GameKana[] => {
    const data = r.data as { script?: string; group?: string; accept?: unknown; lookalikes?: unknown };
    const script = SCRIPTS.find((s) => s === data.script);
    if (!script || !r.romaji) return [];
    return [
      {
        id: r.id,
        kana: r.kana,
        romaji: r.romaji,
        accept: strings(data.accept),
        lookalikes: strings(data.lookalikes),
        script,
        group: (GROUPS as readonly string[]).includes(data.group ?? "") ? (data.group as Group) : "basic",
      },
    ];
  });
}

/** Past games of one mode, newest first. */
export async function loadGames(db: DbOrTx, mode: Mode, limit = 40): Promise<PastGame[]> {
  const rows = await db
    .select({
      playedAt: kanaGames.playedAt,
      score: kanaGames.score,
      cards: kanaGames.cards,
      firstTryRight: kanaGames.firstTryRight,
      meanMs: kanaGames.meanMs,
    })
    .from(kanaGames)
    .where(eq(kanaGames.mode, mode))
    .orderBy(desc(kanaGames.playedAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, playedAt: r.playedAt.toISOString() }));
}

/** Each kana's last `perKana` first answers in one mode, newest first. */
export async function loadAnswers(db: DbOrTx, mode: Mode, perKana = 10): Promise<KanaAnswer[]> {
  const result = await db.execute<{ item_id: number; right: boolean; ms: number }>(sql`
    select item_id, "right", ms from (
      select a.item_id, a."right", a.ms, g.played_at,
        row_number() over (partition by a.item_id order by g.played_at desc) as n
      from ${kanaGameAnswers} a join ${kanaGames} g on g.id = a.game_id
      where g.mode = ${mode}
    ) recent
    where n <= ${perKana}
    order by played_at desc, item_id`);
  return result.rows.map((r) => ({ itemId: r.item_id, right: r.right, ms: r.ms }));
}

/** A finished game, as the device sends it. */
export const SavedGame = z.object({
  id: z.uuid(),
  mode: z.enum(MODES),
  weakest: z.boolean(),
  scripts: z.array(z.enum(SCRIPTS)).min(1),
  groups: z.array(z.enum(GROUPS)),
  playedAt: z.iso.datetime(),
  durationMs: z.int().min(0).max(6 * 60 * 60 * 1000),
  bestStreak: z.int().min(0),
  answers: z
    .array(
      z.object({
        itemId: z.int().positive(),
        right: z.boolean(),
        ms: z.int().min(0).max(24 * 60 * 60 * 1000),
        given: z.string().max(40),
        tries: z.int().min(1).max(1000),
      }),
    )
    .min(1)
    .max(300),
});
export type SavedGame = z.infer<typeof SavedGame>;

/**
 * Saves a game and its answers, and logs its minutes as study time (auto, so they count in
 * This week without ticking a task). Saving the same game again does nothing.
 */
export async function saveGame(db: DbOrTx, game: SavedGame): Promise<{ saved: boolean }> {
  const summary = summarise(game.answers);
  const playedAt = new Date(game.playedAt);
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(kanaGames)
      .values({
        id: game.id,
        mode: game.mode,
        weakest: game.weakest,
        scripts: game.scripts,
        groups: game.groups,
        playedAt,
        studyDate: studyDate(playedAt),
        cards: summary.cards,
        firstTryRight: summary.firstTryRight,
        score: summary.score,
        bestStreak: Math.min(game.bestStreak, summary.cards),
        meanMs: summary.meanMs,
        durationMs: game.durationMs,
      })
      .onConflictDoNothing()
      .returning({ id: kanaGames.id });
    if (inserted.length === 0) return { saved: false };
    await tx
      .insert(kanaGameAnswers)
      .values(game.answers.map((a, i) => ({ gameId: game.id, position: i, ...a })))
      .onConflictDoNothing();
    const minutes = loggedMinutes(game.durationMs);
    if (minutes > 0) {
      await tx.insert(activityLogs).values({
        studyDate: studyDate(playedAt),
        kind: "study",
        skill: "general",
        minutes: Math.min(minutes, 600),
        auto: true,
        note: "Kana game",
      });
    }
    return { saved: true };
  });
}
