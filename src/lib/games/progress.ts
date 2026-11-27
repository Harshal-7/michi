/**
 * Progress over time, for a game's start screen: best and recent scores, accuracy and speed over
 * recent runs against the runs before them, and the weakest items.
 */
import { cardPoints, DEFAULT_SPEED, type Speed } from "./score";

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

/** An item's past answers count back this far. */
export const STRENGTH_ANSWERS = 10;
/** Below this an item is worth practising. */
export const WEAK_BELOW = 85;

/** One first answer to an item (a content slug such as `kana:hiragana:shi`). */
export type ItemAnswer = { item: string; right: boolean; ms: number };
export type Strength = { item: string; strength: number; seen: number; right: number };

/**
 * How well each item is known: the average points (the same 0–100 as the score) of its last
 * few first answers. `answers` newest first.
 */
export function strengths(answers: readonly ItemAnswer[], speed: Speed = DEFAULT_SPEED): Strength[] {
  const by = new Map<string, ItemAnswer[]>();
  for (const a of answers) {
    const list = by.get(a.item) ?? [];
    if (list.length < STRENGTH_ANSWERS) list.push(a);
    by.set(a.item, list);
  }
  return [...by.entries()].map(([item, list]) => ({
    item,
    strength: Math.round(list.reduce((s, a) => s + cardPoints(a.right, a.ms, speed), 0) / list.length),
    seen: list.length,
    right: list.filter((a) => a.right).length,
  }));
}

/** Weakest first: lowest strength, then the one missed more often, then the one seen more. */
export function weakestFirst(list: readonly Strength[]): Strength[] {
  return [...list].sort(
    (a, b) => a.strength - b.strength || a.right / a.seen - b.right / b.seen || b.seen - a.seen || a.item.localeCompare(b.item),
  );
}

/** The items worth practising, weakest first. */
export const weakItems = (list: readonly Strength[]) => weakestFirst(list).filter((s) => s.strength < WEAK_BELOW);
