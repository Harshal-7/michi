/**
 * Checking answers: the romaji typed for a kana (Read it), and the four kana to pick from for a
 * romaji (Find it).
 */
import type { GameKana } from "./types";

/** Lower case letters only, so "Shi ", "ｓｈｉ" and "n'" read as shi, shi and n. */
export const normaliseRomaji = (s: string) => s.normalize("NFKC").trim().toLowerCase().replace(/[^a-z]/g, "");

/** Every typing that counts as right for a kana: the Hepburn answer first, then its `accept` list. */
export function answersFor(kana: Pick<GameKana, "romaji" | "accept">): string[] {
  return [...new Set([kana.romaji, ...kana.accept].map(normaliseRomaji).filter(Boolean))];
}

/**
 * - `right`: what's typed is an answer. `final` is false when a longer answer starts with it
 *   (ん takes n or nn), so the screen waits a moment for another letter before moving on.
 * - `wrong`: no answer starts with it and it's as long as the Hepburn answer.
 * - `typing`: nothing yet, or on the way to an answer, or a slip that's still short.
 */
export type TypedVerdict = { verdict: "right"; final: boolean } | { verdict: "wrong" } | { verdict: "typing" };

export function judgeTyped(typed: string, kana: Pick<GameKana, "romaji" | "accept">): TypedVerdict {
  const t = normaliseRomaji(typed);
  if (!t) return { verdict: "typing" };
  const answers = answersFor(kana);
  if (answers.includes(t)) return { verdict: "right", final: !answers.some((a) => a.length > t.length && a.startsWith(t)) };
  if (answers.some((a) => a.startsWith(t))) return { verdict: "typing" };
  return t.length >= normaliseRomaji(kana.romaji).length ? { verdict: "wrong" } : { verdict: "typing" };
}

/** Enter (or Next) on what's typed: right if it's an answer, otherwise wrong. */
export function isRightTyping(typed: string, kana: Pick<GameKana, "romaji" | "accept">): boolean {
  return answersFor(kana).includes(normaliseRomaji(typed));
}

/** Two kana sound the same to the game when any of their answers match (じ and ぢ are both ji). */
export function soundsSame(a: GameKana, b: GameKana): boolean {
  const theirs = new Set(answersFor(b));
  return answersFor(a).some((x) => theirs.has(x));
}

/** Folds shi, chi, tsu, fu and ji into the rows they sit in: s, t, t, h, z. */
const ROW_OF: Record<string, string> = { sh: "s", ch: "t", ts: "t", f: "h", j: "z" };

/** The gojūon row a kana sits in, from its romaji: "ka" → k, "shi" → s, "kya" → ky, "a" → "". */
export function rowOf(kana: Pick<GameKana, "romaji" | "group">): string {
  const consonant = kana.romaji.replace(/[aiueo]$/, "");
  const row = kana.group === "combo" ? consonant : (ROW_OF[consonant] ?? consonant);
  return `${kana.group === "combo" ? "combo" : "plain"}:${row}`;
}

function shuffled<T>(list: readonly T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The four kana to pick from for Find it: the answer, its look-alikes first, then kana from the
 * same row, the same group, then any, all in the same script. A kana that sounds the same as
 * the answer is never an option. `random` is Math.random in the app, seeded in tests.
 */
export function findOptions(
  target: GameKana,
  all: readonly GameKana[],
  random: () => number = Math.random,
  count = 4,
): { options: GameKana[]; answerIndex: number } {
  const pool = all.filter((k) => k.script === target.script && k.id !== target.id && !soundsSame(k, target));
  const byKana = new Map(pool.map((k) => [k.kana, k]));
  const picked: GameKana[] = [];
  const add = (k: GameKana | undefined) => {
    if (k && picked.length < count - 1 && !picked.includes(k)) picked.push(k);
  };
  for (const look of target.lookalikes) add(byKana.get(look));
  const row = rowOf(target);
  for (const k of shuffled(pool.filter((k) => rowOf(k) === row), random)) add(k);
  for (const k of shuffled(pool.filter((k) => k.group === target.group), random)) add(k);
  for (const k of shuffled(pool, random)) add(k);
  const options = shuffled(picked, random);
  const answerIndex = Math.floor(random() * (options.length + 1));
  options.splice(answerIndex, 0, target);
  return { options, answerIndex };
}
