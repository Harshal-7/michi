/**
 * Checking a typed answer in vocabulary practice, both ways. Forgiving where it doesn't matter
 * (case, punctuation, articles, "to " on verbs, notes in brackets, a small typo on a long
 * word) and strict where it does (a different kana is a different word).
 */
import { finishKana, sameKana } from "./kana";

// ---------------------------------------------------------------------------
// Japanese → English: the meaning

const BRACKETS = /\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g;
const ARTICLES = /(^| )(a|an|the)(?= |$)/g;
/** Words too small to make a near miss on their own. */
const SMALL = new Set(["to", "be", "of", "for", "and", "or", "in", "on", "at", "one", "some", "something", "someone", "thing", "do", "get", "make", "with", "is", "it"]);

function tidy(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’‘]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(ARTICLES, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^to /, "");
}

/**
 * A meaning as it's compared: lower case, no punctuation, no "a", "an" or "the", no leading
 * "to ", no notes in brackets. A meaning that is only a note keeps the note's words.
 */
export function normalizeMeaning(text: string): string {
  return tidy(text.replace(BRACKETS, " ")) || tidy(text);
}

/** Every form of a word's meanings that counts as right: each meaning and each part between commas. */
export function meaningForms(meanings: readonly string[]): string[] {
  const forms = new Set<string>();
  for (const m of meanings) {
    forms.add(normalizeMeaning(m));
    // "to call out, to invite": either half is enough. Not inside brackets.
    const parts = m.replace(BRACKETS, (b) => b.replace(/[,;/]/g, " ")).split(/[,;/]/);
    if (parts.length > 1) for (const p of parts) forms.add(normalizeMeaning(p));
    // "(counter for) machines": with or without the note.
    if (/[([{]/.test(m)) forms.add(tidy(m));
  }
  forms.delete("");
  return [...forms];
}

/** Typos allowed: none up to 4 letters, 1 from 5, 2 from 10. */
export function typosAllowed(expected: string): number {
  const n = expected.replace(/ /g, "").length;
  return n >= 10 ? 2 : n >= 5 ? 1 : 0;
}

/** Edits between two strings, counting a swap of neighbours as one (optimal string alignment). */
export function editDistance(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  const d: number[][] = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array<number>(y.length).fill(0)]);
  for (let j = 1; j <= y.length; j++) d[0][j] = j;
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[x.length][y.length];
}

/** A rough stem for near misses: "eating" and "eats" share "eat". */
function stem(word: string): string {
  return word.replace(/(ing|ed|es|s)$/, "") || word;
}

function bigWords(text: string): Set<string> {
  return new Set(
    text
      .split(" ")
      .filter((w) => w.length >= 3 && !SMALL.has(w))
      .map(stem),
  );
}

export type MeaningResult = {
  right: boolean;
  /** Right, but spelled a little differently from `matched`. */
  typo: boolean;
  /** Wrong, but close enough to offer "Count it as right". */
  near: boolean;
  /** The meaning it matched, as written in the list. */
  matched: string | null;
};

const EMPTY: MeaningResult = { right: false, typo: false, near: false, matched: null };

/**
 * Checks a typed meaning against a word's meanings. Several answers split by commas are right
 * when each one is.
 */
export function checkMeaning(typed: string, meanings: readonly string[]): MeaningResult {
  const answers = typed
    .split(/[,;/]/)
    .map(normalizeMeaning)
    .filter(Boolean);
  if (answers.length === 0) return EMPTY;
  const byForm = new Map<string, string>();
  for (const m of meanings) for (const f of meaningForms([m])) if (!byForm.has(f)) byForm.set(f, m);
  const forms = [...byForm.keys()];

  let typo = false;
  let matched: string | null = null;
  let allRight = true;
  for (const answer of answers) {
    const exact = forms.find((f) => f === answer);
    if (exact !== undefined) {
      matched ??= byForm.get(exact)!;
      continue;
    }
    const close = forms.find((f) => editDistance(answer, f) <= typosAllowed(f));
    if (close !== undefined) {
      typo = true;
      matched ??= byForm.get(close)!;
      continue;
    }
    allRight = false;
  }
  if (allRight) return { right: true, typo, near: false, matched };

  // A near miss: a few letters off, or sharing a real word with a meaning ("born" for "to be born").
  const near = answers.some((answer) => {
    const words = bigWords(answer);
    return forms.some((f) => {
      if (f.length >= 3 && editDistance(answer, f) <= typosAllowed(f) + 2) return true;
      for (const w of bigWords(f)) if (words.has(w)) return true;
      return false;
    });
  });
  return { right: false, typo: false, near, matched: null };
}

// ---------------------------------------------------------------------------
// English → Japanese: the word

export type JaWord = { term: string; reading: string };

export type JaTarget = JaWord & {
  /** Other ways to write it from the dictionary (逢う for 会う), kanji or kana. */
  forms?: readonly string[];
  /** Other words that share one of its meanings (大きな for 大きい), each with its meaning. */
  others?: readonly (JaWord & { meaning: string })[];
};

export type JapaneseResult = {
  right: boolean;
  /** Wrong, but one kana off: offer "Count it as right". */
  near: boolean;
  /** Right as a different word with the same meaning: show both. */
  other: (JaWord & { meaning: string }) | null;
  /** What was typed, with any romaji turned into kana. */
  typed: string;
};

function writes(typed: string, word: JaWord, forms: readonly string[] = []): boolean {
  const kana = sameKana(typed);
  return [word.term, word.reading, ...forms].some((f) => f && sameKana(f) === kana);
}

/**
 * Checks a typed word: its reading in hiragana or katakana, its written form, another way of
 * writing it, or another word with the same meaning. Romaji left in the answer counts as kana.
 */
export function checkJapanese(input: string, target: JaTarget): JapaneseResult {
  const typed = finishKana(input);
  if (!typed) return { right: false, near: false, other: null, typed };
  if (writes(typed, target, target.forms)) return { right: true, near: false, other: null, typed };
  const other = target.others?.find((o) => writes(typed, o)) ?? null;
  if (other) return { right: true, near: false, other, typed };
  const reading = sameKana(target.reading);
  const near = [...reading].length >= 3 && editDistance(sameKana(typed), reading) <= 1;
  return { right: false, near, other: null, typed };
}
