/** Typed vocabulary practice: what the page and the browser share. */

export const VOCAB_LEVELS = ["N5", "N4", "N3"] as const;
export type Level = (typeof VOCAB_LEVELS)[number];

/** ja_en: see the word, type the meaning. en_ja: see the meaning, type the word. */
export const DIRECTIONS = ["ja_en", "en_ja"] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** Which words a set takes: all, the ones not typed right yet, or the ones missed last time. */
export const FILTERS = ["all", "not_right", "missed"] as const;
export type Filter = (typeof FILTERS)[number];

export const ORDERS = ["list", "shuffled"] as const;
export type Order = (typeof ORDERS)[number];

export type Progress = { right: number; wrong: number; lastRight: boolean };

export type VocabWord = {
  id: number;
  term: string;
  /** In kana. */
  reading: string;
  meanings: string[];
  pos: string[];
  usuallyKana: boolean;
  /** The example sentence (ruby markup) with its English and Tatoeba credit, as content stores it. */
  example: ({ ja: string; en: string } & Record<string, unknown>) | null;
  /** Other ways to write it, from the dictionary. */
  forms: string[];
  /** Other words with one of the same meanings; typing one counts as right. */
  others: { term: string; reading: string; meaning: string }[];
  progress: Record<Direction, Progress | null>;
};

export function isLevel(v: unknown): v is Level {
  return typeof v === "string" && (VOCAB_LEVELS as readonly string[]).includes(v);
}

/** Does a word belong in a set with this filter, going this way? */
export function inFilter(word: VocabWord, direction: Direction, filter: Filter): boolean {
  const p = word.progress[direction];
  if (filter === "not_right") return !p || p.right === 0;
  if (filter === "missed") return !!p && !p.lastRight;
  return true;
}

/** How many words each filter takes, for the choices' labels. */
export function filterCounts(words: VocabWord[], direction: Direction): Record<Filter, number> {
  const counts = { all: 0, not_right: 0, missed: 0 };
  for (const w of words) for (const f of FILTERS) if (inFilter(w, direction, f)) counts[f]++;
  return counts;
}

/** A seeded shuffle (mulberry32 + Fisher–Yates), so a set can be rebuilt the same way. */
export function shuffled<T>(list: readonly T[], seed: number): T[] {
  let a = seed >>> 0;
  const random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The words for one run through: filtered, then in list order or shuffled. */
export function buildSet(words: VocabWord[], options: { direction: Direction; filter: Filter; order: Order; seed: number }): VocabWord[] {
  const picked = words.filter((w) => inFilter(w, options.direction, options.filter));
  return options.order === "shuffled" ? shuffled(picked, options.seed) : picked;
}
