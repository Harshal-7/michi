/**
 * Scoring, the same for every game. Each card is worth up to 100 points: 70 for right first
 * time, and up to 30 more for speed, all 30 within the game's `fullMs`, falling to none at its
 * `noneMs` (src/lib/games/registry.ts sets them per game). A run's score is the average, so runs
 * of any length compare. The server works it out again from the answers (src/lib/games/check.ts).
 */

export const RIGHT_POINTS = 70;
export const SPEED_POINTS = 30;

/** How fast earns the speed points: all of them within `fullMs`, none after `noneMs`. */
export type Speed = { fullMs: number; noneMs: number };

/** The kana game's: 1.5 and 5 seconds. */
export const DEFAULT_SPEED: Speed = { fullMs: 1500, noneMs: 5000 };

export function cardPoints(right: boolean, ms: number, speed: Speed = DEFAULT_SPEED): number {
  if (!right) return 0;
  const share = Math.min(1, Math.max(0, (speed.noneMs - ms) / (speed.noneMs - speed.fullMs)));
  return RIGHT_POINTS + SPEED_POINTS * share;
}

export type RunSummary = {
  cards: number;
  firstTryRight: number;
  /** 0–100. */
  score: number;
  /** Mean time to a right first answer, in ms; null when none was right first time. */
  meanMs: number | null;
};

export function summarise(first: readonly { right: boolean; ms: number }[], speed: Speed = DEFAULT_SPEED): RunSummary {
  const right = first.filter((a) => a.right);
  const total = first.reduce((s, a) => s + cardPoints(a.right, a.ms, speed), 0);
  return {
    cards: first.length,
    firstTryRight: right.length,
    score: first.length ? Math.round(total / first.length) : 0,
    meanMs: right.length ? Math.round(right.reduce((s, a) => s + a.ms, 0) / right.length) : null,
  };
}

/** The longest run of first tries right, in the order the cards were first shown. */
export function bestStreakOf(first: readonly { right: boolean }[]): number {
  let best = 0;
  let now = 0;
  for (const a of first) {
    now = a.right ? now + 1 : 0;
    best = Math.max(best, now);
  }
  return best;
}

/** "1.4 s" */
export const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** The whole minutes a run logs to `activity_logs`: rounded, and none under half a minute. */
export const loggedMinutes = (durationMs: number) => Math.round(durationMs / 60000);
