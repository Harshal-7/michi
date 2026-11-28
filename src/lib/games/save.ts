/**
 * Saving a finished run for a player: checked and scored again on the server (check.ts), stored
 * once however often the device sends it, and for Harshal only, its minutes logged as study or
 * listening time (decision H). Runs never touch the review schedule.
 */
import type { DbOrTx } from "@/db/client";
import { insertRun, type Player } from "@/db/play";
import { studyDate } from "@/lib/day";

import { checkRun } from "./check";
import { gameBySlug } from "./registry";
import { loggedMinutes } from "./score";
import { GameRun } from "./types";

export type SaveResult = { ok: true; saved: boolean; ranked: boolean; score: number } | { ok: false; error: string };

export async function saveRun(db: DbOrTx, player: Player, input: unknown, now = new Date()): Promise<SaveResult> {
  const parsed = GameRun.safeParse(input);
  if (!parsed.success) return { ok: false, error: "not a run" };
  const run = parsed.data;
  const game = gameBySlug(run.game);
  if (!game) return { ok: false, error: "unknown game" };
  const rules = await game.rules();
  const checked = checkRun(run, rules.setup(run.setup), game.speed, now);
  if ("error" in checked) return { ok: false, error: checked.error };
  const playedAt = new Date(run.playedAt);
  const { saved } = await insertRun(
    db,
    player.id,
    {
      id: run.id,
      game: game.slug,
      setup: run.setup,
      ranked: checked.ranked,
      playedAt,
      studyDate: studyDate(playedAt),
      cards: checked.cards,
      firstTryRight: checked.firstTryRight,
      score: checked.score,
      bestStreak: checked.bestStreak,
      meanMs: checked.meanMs,
      durationMs: run.durationMs,
      answers: run.answers,
    },
    player.isOwner ? { ...game.log, minutes: loggedMinutes(run.durationMs), note: game.name } : null,
  );
  return { ok: true, saved, ranked: checked.ranked, score: checked.score };
}
