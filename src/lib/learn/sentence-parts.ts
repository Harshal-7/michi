/**
 * The pure half of your own sentences (src/lib/learn/sentences.ts), safe to use in the browser:
 * marking the grammar part as the fill-in blank, and undoing that for editing.
 */
import { blanks, toPlain } from "@content/schema";

export type MySentence = { id: number; ja: string; en: string; checked: boolean };

/** Characters that mean something in the markup, so a typed sentence can't hold them. */
const MARKUP = /[[\]{}|]/;
/** Runs of Japanese: kana, kanji and the long-vowel mark. */
const JA_RUN = /[ぁ-ゖァ-ヺー々〆一-鿿㐀-䶿]+/gu;

/**
 * The grammar part to prefill from a lesson's title: the first form, without 〜, brackets or
 * placeholders, and its longest Japanese run ("〜てください" → "てください", "AはBより〜" → "より").
 */
export function defaultPart(pattern: string): string {
  const first = toPlain(pattern).split(/\s*\/\s*/)[0] ?? "";
  const bare = first.replace(/[(（][^)）]*[)）]/g, "");
  const runs = bare.match(JA_RUN) ?? [];
  return runs.reduce((best, r) => (r.length > best.length ? r : best), "");
}

/** The sentence with its grammar part marked as the fill-in answer, or why it can't be. */
export function markPart(sentence: string, part: string): { ja: string } | { error: string } {
  const s = sentence.trim();
  const p = part.trim();
  if (!s) return { error: "Write a sentence first." };
  if (!p) return { error: "Say which part is the grammar, so it can be the blank." };
  if (MARKUP.test(s) || MARKUP.test(p)) return { error: "Leave out [ ] { } and | . Plain text is enough." };
  const at = s.indexOf(p);
  if (at === -1) return { error: `「${p}」 isn't in the sentence. Check they're written the same way.` };
  if (s.indexOf(p, at + 1) !== -1) return { error: `「${p}」 is in the sentence more than once. Make the grammar part a little longer.` };
  return { ja: `${s.slice(0, at)}[[${p}]]${s.slice(at + p.length)}` };
}

/** The sentence and grammar part a stored sentence was written as, for editing it. */
export function splitPart(ja: string): { sentence: string; part: string } {
  return { sentence: toPlain(ja), part: blanks(ja)[0] ?? "" };
}
