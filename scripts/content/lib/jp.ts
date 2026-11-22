/** Small helpers for Japanese text: kana conversion and kanji detection. */

/** Kanji, plus the marks that sit in kanji runs: 々 (repeat), 〆, and ヶ/ヵ as in 一ヶ月. */
const KANJI_CHAR = /[\p{Script=Han}々〆ヵヶ]/u;
const KANA_ONLY = /^[\p{Script=Hiragana}\p{Script=Katakana}ー・]+$/u;

export const isKanjiChar = (c: string) => KANJI_CHAR.test(c);
export const hasKanji = (s: string) => [...s].some(isKanjiChar);
/** Hiragana, katakana and the long-vowel mark only. */
export const isKana = (s: string) => s.length > 0 && KANA_ONLY.test(s) && !hasKanji(s);

/** Katakana to hiragana. ー and other characters are left alone. */
export function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** Hiragana to katakana. */
export function toKatakana(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

/** The fullwidth tilde used by some sources becomes the wave dash learners see in lists: 〜月. */
export const normaliseTilde = (s: string) => s.replace(/[～~]/g, "〜");

/** Splits text into kanji runs and everything else, in order. */
export function splitRuns(s: string): { kanji: boolean; text: string }[] {
  const out: { kanji: boolean; text: string }[] = [];
  for (const c of s) {
    const kanji = isKanjiChar(c);
    const last = out.at(-1);
    if (last && last.kanji === kanji) last.text += c;
    else out.push({ kanji, text: c });
  }
  return out;
}
