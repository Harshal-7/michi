/**
 * Every public game, in the order the /play hub and sidebar list them. Wave 2 adds one entry per
 * game here (see the hand-over note): its slug and address, name and glyph, modes, standard
 * setups (the ones with leaderboards), speed for the score, the skill its minutes log for
 * Harshal, and its server-side rules, loaded only when a run is saved.
 */
import { KANA_SETUPS } from "./kana/setups";
import { MODE_LABELS, MODES } from "./kana/types";
import type { Speed } from "./score";
import type { GameRules } from "./types";

export type GameEntry = {
  /** Also the `game_runs.game` value and the address under /play. */
  slug: string;
  name: string;
  /** One Japanese character for the hub and sidebar. */
  glyph: string;
  href: string;
  /** One line for the hub. */
  note: string;
  /** The first part of every setup key; progress shows per mode. */
  modes: { key: string; label: string }[];
  /** Standard setups: only these rank (decision C). */
  setups: { key: string; label: string; mode: string }[];
  speed: Speed;
  /** Where Harshal's minutes go (decision H). Listening games log listening; the rest study time. */
  log: { kind: "study" | "listening"; skill: "general" | "listening" };
  rules: () => Promise<GameRules>;
};

export const GAMES: readonly GameEntry[] = [
  {
    slug: "kana",
    name: "Kana game",
    glyph: "か",
    href: "/play/kana",
    note: "read a kana and type it, or hear it and find it",
    modes: MODES.map((m) => ({ key: m, label: MODE_LABELS[m] })),
    setups: KANA_SETUPS,
    speed: { fullMs: 1500, noneMs: 5000 },
    log: { kind: "study", skill: "general" },
    rules: async () => (await import("./kana/rules")).kanaRules,
  },
];

export const gameBySlug = (slug: string): GameEntry | null => GAMES.find((g) => g.slug === slug) ?? null;
