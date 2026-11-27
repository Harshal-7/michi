/**
 * The server's checks on a finished run before it's saved (decision C). It works the score out
 * again from the answers and turns a run away when:
 * - the game doesn't know its setup, or it asks an item that isn't in that setup's content;
 * - it has more cards than the setup, or the same item twice;
 * - its times can't be right: a right answer quicker than a person can, answers adding up to
 *   more than the run took, or a date in the future or long ago.
 * A run with fewer cards than its setup (stopped early) is kept but doesn't rank.
 */
import { bestStreakOf, type RunSummary, type Speed, summarise } from "./score";
import type { GameRun, SetupRule } from "./types";

/** Quicker than this to a right answer isn't a person. */
export const MIN_RIGHT_MS = 200;
/** A device's clock may run this far ahead. */
export const CLOCK_SKEW_MS = 5 * 60 * 1000;
/** A run waiting on a device this long is still taken. */
export const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;
/** The answers' times may add up to this much more than the run's (rounding, a slow frame). */
export const DURATION_SLACK_MS = 2000;

export type CheckedRun = RunSummary & { ranked: boolean; bestStreak: number };

export function checkRun(run: GameRun, rule: SetupRule | null, speed: Speed, now = new Date()): CheckedRun | { error: string } {
  if (!rule) return { error: "unknown setup" };
  if (run.answers.length > rule.cards) return { error: "more cards than the setup" };
  const items = new Set<string>();
  for (const a of run.answers) {
    if (!rule.items.has(a.item)) return { error: `unknown item ${a.item}` };
    if (items.has(a.item)) return { error: `${a.item} twice` };
    items.add(a.item);
    if (a.right && a.ms < MIN_RIGHT_MS) return { error: "an answer quicker than possible" };
  }
  const answered = run.answers.reduce((s, a) => s + a.ms, 0);
  if (answered > run.durationMs + DURATION_SLACK_MS) return { error: "answer times longer than the run" };
  const played = Date.parse(run.playedAt);
  if (played > now.getTime() + CLOCK_SKEW_MS || played < now.getTime() - MAX_AGE_MS) return { error: "played at an unlikely time" };
  return {
    ...summarise(run.answers, speed),
    bestStreak: bestStreakOf(run.answers),
    ranked: rule.standard && run.answers.length === rule.cards,
  };
}
