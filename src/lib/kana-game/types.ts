/** The kana game's shared types: what a kana looks like to the game, and the choices on its start screen. */

export const SCRIPTS = ["hiragana", "katakana"] as const;
export type Script = (typeof SCRIPTS)[number];

export const GROUPS = ["basic", "dakuten", "combo", "extended"] as const;
export type Group = (typeof GROUPS)[number];

/** read: a kana is shown, type its romaji. find: the romaji is shown (and said), pick the kana. */
export const MODES = ["read", "find"] as const;
export type Mode = (typeof MODES)[number];

/** How many kana a game asks; 0 means every kana picked. */
export const LENGTHS = [20, 50, 0] as const;
export type Length = (typeof LENGTHS)[number];

/** How many kana the weakest-kana game asks. */
export const WEAKEST_COUNT = 20;

export type GameKana = {
  id: number;
  kana: string;
  /** The Hepburn answer shown: shi, chi, tsu. */
  romaji: string;
  /** Other typings that count as right: si, ti, tu. */
  accept: string[];
  lookalikes: string[];
  script: Script;
  group: Group;
};

export type GameSettings = {
  mode: Mode;
  scripts: Script[];
  groups: Group[];
  length: Length;
  /** Soft tones on right and wrong answers. */
  tones: boolean;
};

export const DEFAULT_SETTINGS: GameSettings = {
  mode: "read",
  scripts: ["hiragana"],
  groups: ["basic"],
  length: 20,
  tones: true,
};

export const GROUP_LABELS: Record<Group, string> = {
  basic: "Basic",
  dakuten: "Dakuten",
  combo: "Combinations",
  extended: "Extended",
};

export const MODE_LABELS: Record<Mode, string> = { read: "Read it", find: "Find it" };
