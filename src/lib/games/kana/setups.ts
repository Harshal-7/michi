/**
 * The kana game's setup keys: `<mode>:<scripts>:<groups>:<cards>` (`read:hiragana:basic:20`), or
 * `<mode>:weakest:<cards>` for "Practise your weakest". The first part is the mode, as for every
 * game, so progress can be shown per mode. Only the standard setups rank (decision C).
 */
import { GROUPS, type Group, LENGTHS, type Mode, MODE_LABELS, MODES, type Script, SCRIPTS, WEAKEST_COUNT } from "./types";

const STANDARD: [Script[], Group[], number, string][] = [
  [["hiragana"], ["basic"], 20, "Hiragana · Basic · 20"],
  [["katakana"], ["basic"], 20, "Katakana · Basic · 20"],
  [["hiragana", "katakana"], [...GROUPS], 50, "Both · All groups · 50"],
];

export function setupKey(mode: Mode, scripts: readonly Script[], groups: readonly Group[], cards: number): string {
  const s = SCRIPTS.filter((x) => scripts.includes(x));
  const g = GROUPS.filter((x) => groups.includes(x));
  return `${mode}:${s.join("+")}:${g.join("+")}:${cards}`;
}

export const weakestKey = (mode: Mode, cards: number) => `${mode}:weakest:${cards}`;

/** The setups with leaderboards, in the order the boards list them. */
export const KANA_SETUPS: { key: string; label: string; mode: Mode }[] = MODES.flatMap((mode) =>
  STANDARD.map(([scripts, groups, cards, label]) => ({ key: setupKey(mode, scripts, groups, cards), label: `${MODE_LABELS[mode]} · ${label}`, mode })),
);

export type ParsedSetup =
  | { mode: Mode; weakest: false; scripts: Script[]; groups: Group[]; cards: number }
  | { mode: Mode; weakest: true; cards: number };

/** A setup key taken apart, or null when it isn't one. Scripts and groups must be in their usual order. */
export function parseSetup(key: string): ParsedSetup | null {
  const parts = key.split(":");
  const mode = MODES.find((m) => m === parts[0]);
  const cards = Number(parts.at(-1));
  if (!mode || !Number.isInteger(cards) || cards < 1 || String(cards) !== parts.at(-1)) return null;
  if (parts.length === 3 && parts[1] === "weakest") return cards <= WEAKEST_COUNT ? { mode, weakest: true, cards } : null;
  if (parts.length !== 4) return null;
  const scripts = parts[1].split("+");
  const groups = parts[2].split("+");
  const s = SCRIPTS.filter((x) => scripts.includes(x));
  const g = GROUPS.filter((x) => groups.includes(x));
  if (s.length === 0 || g.length === 0 || s.join("+") !== parts[1] || g.join("+") !== parts[2]) return null;
  return { mode, weakest: false, scripts: s, groups: g, cards };
}

/** The deck sizes a start screen offers for a pool: 20, 50 or all, never more than there are. */
export const deckSizes = (pool: number) => [...new Set(LENGTHS.map((l) => (l === 0 ? pool : Math.min(l, pool))))];
