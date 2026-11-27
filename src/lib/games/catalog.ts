/**
 * What the /play hub, the game tiles and the leaderboards show for each of the 7 public games
 * (decision A), in hub order, including the ones still to come: a game is live once it has an
 * entry in the registry (src/lib/games/registry.ts). Each game has its own colour, the
 * `--g-<slug>` and `--g-<slug>-tint` tokens in globals.css.
 */
import type { CSSProperties } from "react";

import { gameBySlug } from "./registry";

export type CatalogGame = {
  slug: string;
  name: string;
  /** For the narrow tiles on the phone's leaderboard. */
  short: string;
  glyph: string;
  /** One line for the hub; `ja` is Japanese at its end, set apart for `lang="ja"`. */
  note: string;
  ja?: string;
  minutes: number;
  /** Listening games: the hub shows a sound icon. */
  sound: boolean;
};

export const CATALOG: readonly CatalogGame[] = [
  { slug: "kana", name: "Kana game", short: "Kana", glyph: "か", note: "Read a kana and type it, or hear it and find it", minutes: 1, sound: false },
  { slug: "vocab", name: "Vocabulary", short: "Vocab", glyph: "語", note: "Type the meaning, the word or how it’s read", minutes: 2, sound: false },
  { slug: "forms", name: "Verb forms", short: "Verbs", glyph: "て", note: "Make each verb form: ", ja: "ます・ない・て・た", minutes: 2, sound: false },
  { slug: "particles", name: "Particles", short: "Particles", glyph: "を", note: "Pick the particle that fits the sentence", minutes: 2, sound: false },
  { slug: "numbers", name: "Numbers by ear", short: "Numbers", glyph: "数", note: "Hear a number, price or time and type it", minutes: 2, sound: true },
  { slug: "sounds", name: "Sound pairs", short: "Sounds", glyph: "音", note: "Hear a word and pick it from a close pair", minutes: 2, sound: true },
  { slug: "listen", name: "Listen and type", short: "Listen", glyph: "聞", note: "Hear a short sentence and type it in kana", minutes: 3, sound: true },
];

export const SLUGS = CATALOG.map((g) => g.slug);

export const catalogGame = (slug: string): CatalogGame | null => CATALOG.find((g) => g.slug === slug) ?? null;

/** A game can be played once the registry has it; the rest show as "Soon". */
export const isLive = (slug: string) => gameBySlug(slug) !== null;

/**
 * The game's colour for everything inside: `bg-hue-tint`, `text-hue`, `border-hue` read these.
 * Unknown slugs fall back to the kana game's colour (the accent).
 */
export function hueStyle(slug: string): CSSProperties {
  const s = SLUGS.includes(slug) ? slug : "kana";
  return { "--hue": `var(--g-${s})`, "--hue-tint": `var(--g-${s}-tint)` } as CSSProperties;
}

/**
 * A player's colour, from their name, so they look the same in the pill, on the podium and in the
 * rows: one of the 7 game colours. It only depends on the name's lower-case form.
 */
export function playerHue(name: string): string {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.codePointAt(0)!) % 9973;
  return SLUGS[h % SLUGS.length];
}
