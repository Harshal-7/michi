/**
 * A game's deck and its turns. Every kana picked is asked once, in a shuffled order. A miss
 * shows the answer and the kana comes back a few cards later, until it's answered right; the
 * score only counts first tries.
 */
import { cardPoints } from "./score";
import type { GameKana, GameSettings, Group, Script } from "./types";

/** The kana that match the picked scripts and groups. Extended sounds are katakana only. */
export function kanaFor(all: readonly GameKana[], scripts: readonly Script[], groups: readonly Group[]): GameKana[] {
  return all.filter((k) => scripts.includes(k.script) && groups.includes(k.group));
}

/** A shuffled deck of `length` kana from `pool` (all of them when `length` is 0 or more than there are). */
export function buildDeck(pool: readonly GameKana[], length: GameSettings["length"], random: () => number = Math.random): GameKana[] {
  const deck = [...pool];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return length > 0 ? deck.slice(0, length) : deck;
}

/** A missed kana comes back this many cards later (or last, when fewer are left). */
export const COME_BACK_AFTER = 3;

export type FirstAnswer = { right: boolean; ms: number; given: string };

export type GameState = {
  /** Card indexes still to answer; the first is on screen. */
  queue: number[];
  /** Each card's first answer, once it has one. */
  first: (FirstAnswer | null)[];
  tries: number[];
  /** First tries right in a row. */
  streak: number;
  bestStreak: number;
  /** Points so far, from first tries. */
  points: number;
};

export function startGame(cards: number): GameState {
  return {
    queue: Array.from({ length: cards }, (_, i) => i),
    first: Array<FirstAnswer | null>(cards).fill(null),
    tries: Array<number>(cards).fill(0),
    streak: 0,
    bestStreak: 0,
    points: 0,
  };
}

export const currentCard = (state: GameState): number | null => state.queue[0] ?? null;
export const isFinished = (state: GameState) => state.queue.length === 0;

/** Answers the card on screen. Right takes it out of the deck; wrong sends it back a few cards. */
export function answer(state: GameState, a: FirstAnswer): GameState {
  const [card, ...rest] = state.queue;
  if (card === undefined) return state;
  const tries = state.tries.map((t, i) => (i === card ? t + 1 : t));
  const isFirst = state.first[card] === null;
  const first = isFirst ? state.first.map((f, i) => (i === card ? a : f)) : state.first;
  const streak = !isFirst ? state.streak : a.right ? state.streak + 1 : 0;
  const queue = a.right ? rest : [...rest.slice(0, COME_BACK_AFTER), card, ...rest.slice(COME_BACK_AFTER)];
  return {
    queue,
    first,
    tries,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    points: state.points + (isFirst ? cardPoints(a.right, a.ms) : 0),
  };
}

/** Whether the card on screen has been missed already this game (so this is a second try). */
export const isRetry = (state: GameState): boolean => {
  const card = currentCard(state);
  return card !== null && state.first[card] !== null;
};
