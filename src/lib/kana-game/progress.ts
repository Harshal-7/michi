/**
 * Progress over time, for the start screen: best and recent scores, accuracy and speed over
 * recent games against the games before them, and the weakest kana.
 */
import { cardPoints } from "./score";

export type PastGame = {
  playedAt: string;
  score: number;
  cards: number;
  firstTryRight: number;
  meanMs: number | null;
};

/** Games compared at a time: "the last 5" against "the 5 before". */
export const WINDOW = 5;
/** Games drawn on the chart. */
export const CHART_GAMES = 20;

export type Window = { accuracy: number; meanMs: number | null; games: number };

/** Accuracy (first tries right, over all cards) and mean speed across some games. */
export function windowOf(games: readonly PastGame[]): Window | null {
  if (games.length === 0) return null;
  const cards = games.reduce((s, g) => s + g.cards, 0);
  const right = games.reduce((s, g) => s + g.firstTryRight, 0);
  // Speed weighted by how many were right in each game, so a 50-kana game counts for more than a 20.
  const timed = games.filter((g) => g.meanMs !== null && g.firstTryRight > 0);
  const timedRight = timed.reduce((s, g) => s + g.firstTryRight, 0);
  return {
    accuracy: cards ? Math.round((right / cards) * 100) : 0,
    meanMs: timedRight ? Math.round(timed.reduce((s, g) => s + g.meanMs! * g.firstTryRight, 0) / timedRight) : null,
    games: games.length,
  };
}

export type Progress = {
  games: number;
  best: PastGame | null;
  last: PastGame | null;
  /** The last few games and the few before them. */
  recent: Window | null;
  before: Window | null;
  /** Oldest first, for the chart. */
  chart: PastGame[];
};

/** `games` newest first. */
export function progressOf(games: readonly PastGame[]): Progress {
  const best = games.reduce<PastGame | null>((b, g) => (b === null || g.score > b.score ? g : b), null);
  return {
    games: games.length,
    best,
    last: games[0] ?? null,
    recent: windowOf(games.slice(0, WINDOW)),
    before: windowOf(games.slice(WINDOW, WINDOW * 2)),
    chart: games.slice(0, CHART_GAMES).reverse(),
  };
}

/** A kana's past answers count back this far. */
export const STRENGTH_ANSWERS = 10;
/** Below this a kana is worth practising. */
export const WEAK_BELOW = 85;

export type KanaAnswer = { itemId: number; right: boolean; ms: number };
export type Strength = { itemId: number; strength: number; seen: number; right: number };

/**
 * How well each kana is known: the average points (the same 0–100 as the score) of its last
 * few first answers. `answers` newest first.
 */
export function strengths(answers: readonly KanaAnswer[]): Strength[] {
  const by = new Map<number, KanaAnswer[]>();
  for (const a of answers) {
    const list = by.get(a.itemId) ?? [];
    if (list.length < STRENGTH_ANSWERS) list.push(a);
    by.set(a.itemId, list);
  }
  return [...by.entries()].map(([itemId, list]) => ({
    itemId,
    strength: Math.round(list.reduce((s, a) => s + cardPoints(a.right, a.ms), 0) / list.length),
    seen: list.length,
    right: list.filter((a) => a.right).length,
  }));
}

/** Weakest first: lowest strength, then the one missed more often, then the one seen more. */
export function weakestFirst(list: readonly Strength[]): Strength[] {
  return [...list].sort((a, b) => a.strength - b.strength || a.right / a.seen - b.right / b.seen || b.seen - a.seen || a.itemId - b.itemId);
}

/** The kana worth practising, weakest first. */
export const weakKana = (list: readonly Strength[]) => weakestFirst(list).filter((s) => s.strength < WEAK_BELOW);
