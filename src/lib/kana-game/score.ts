/**
 * Scoring. Each kana is worth up to 100 points: 70 for right first time, and up to 30 more for
 * speed, all 30 within 1.5 seconds, falling to none at 5 seconds. A game's score is the average,
 * so games of any length compare.
 */

export const RIGHT_POINTS = 70;
export const SPEED_POINTS = 30;
/** Right within this long earns every speed point. */
export const FULL_SPEED_MS = 1500;
/** Right after this long earns no speed points. */
export const NO_SPEED_MS = 5000;

export function cardPoints(right: boolean, ms: number): number {
  if (!right) return 0;
  const share = Math.min(1, Math.max(0, (NO_SPEED_MS - ms) / (NO_SPEED_MS - FULL_SPEED_MS)));
  return RIGHT_POINTS + SPEED_POINTS * share;
}

export type GameSummary = {
  cards: number;
  firstTryRight: number;
  /** 0–100. */
  score: number;
  /** Mean time to a right first answer, in ms; null when none was right first time. */
  meanMs: number | null;
};

export function summarise(first: readonly { right: boolean; ms: number }[]): GameSummary {
  const right = first.filter((a) => a.right);
  const total = first.reduce((s, a) => s + cardPoints(a.right, a.ms), 0);
  return {
    cards: first.length,
    firstTryRight: right.length,
    score: first.length ? Math.round(total / first.length) : 0,
    meanMs: right.length ? Math.round(right.reduce((s, a) => s + a.ms, 0) / right.length) : null,
  };
}

/** "1.4 s" */
export const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** The whole minutes a game logs to `activity_logs`: rounded, and none under half a minute. */
export const loggedMinutes = (durationMs: number) => Math.round(durationMs / 60000);
