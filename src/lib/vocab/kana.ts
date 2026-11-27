/**
 * Romaji in the Japanese answer box. While you type, wanakana's `bind` turns romaji into kana in
 * the box itself (the page sets it up); this finishes what is left when you press Enter, such as
 * a last "n", and makes the forms that count as the same spelling.
 */
import { toHiragana, toKana, toKatakana, toRomaji } from "wanakana";

const SPACES = /[\s　]+/g;

/**
 * The typed answer as it is checked and shown: romaji still in it becomes kana (lowercase to
 * hiragana, capitals to katakana), a last "n" becomes ん, and spaces go. Kanji and kana stay.
 */
export function finishKana(typed: string): string {
  return toKana(typed.normalize("NFKC").replace(SPACES, ""));
}

const VOWELS: Record<string, string> = { a: "あ", i: "い", u: "う", e: "え", o: "お" };

/**
 * One spelling for kana: hiragana, with a long-vowel mark written out as the vowel before it, so
 * コーヒー, こーひー and こおひい (koohii) compare equal. Kanji pass through.
 */
export function sameKana(text: string): string {
  const hiragana = toHiragana(toKatakana(finishKana(text)), { convertLongVowelMark: false });
  let out = "";
  for (const ch of hiragana) {
    const vowel = ch === "ー" && out ? VOWELS[toRomaji(out.at(-1)!).at(-1) ?? ""] : undefined;
    out += vowel ?? ch;
  }
  return out;
}
