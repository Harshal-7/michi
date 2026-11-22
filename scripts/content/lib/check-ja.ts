/** Checks for Japanese that we write by hand: ruby on every kanji run, kana readings, kanji in level. */
import { blanks, isValidRuby, parseRuby } from "../../../content/schema";
import { hasKanji, isKanjiChar } from "./jp";

/** Ruby readings are written in hiragana (katakana is allowed for loanword bases, ー for long vowels). */
export const isRubyReading = (s: string) => /^[ぁ-ゖァ-ヺー]+$/u.test(s);

export type JaProblem = string;

/**
 * Problems with one piece of Japanese text: broken markup, kanji without ruby, readings that
 * aren't kana, ruby on text that has no kanji, and kanji outside the allowed set.
 */
export function checkJa(text: string, { allowedKanji, needsBlank = false }: { allowedKanji?: Set<string>; needsBlank?: boolean } = {}): JaProblem[] {
  const problems: JaProblem[] = [];
  const bare = text.replace(/\[\[|\]\]/g, "");
  if (!isValidRuby(bare)) problems.push("broken ruby markup");
  const count = blanks(text).length;
  if (needsBlank && count !== 1) problems.push(`needs exactly one [[answer]], found ${count}`);
  if (!needsBlank && count > 0) problems.push("has a [[blank]] where none belongs");
  for (const seg of parseRuby(bare)) {
    if (seg.reading === undefined) {
      const loose = [...seg.text].filter(isKanjiChar);
      if (loose.length) problems.push(`kanji without ruby: ${loose.join("")}`);
      continue;
    }
    if (!isRubyReading(seg.reading)) problems.push(`reading isn't kana: {${seg.text}|${seg.reading}}`);
    if (!hasKanji(seg.text)) problems.push(`ruby on text without kanji: {${seg.text}|${seg.reading}}`);
    if ([...seg.text].some((c) => !isKanjiChar(c))) problems.push(`ruby base mixes kana and kanji: {${seg.text}|${seg.reading}}`);
  }
  if (allowedKanji) {
    const outside = [...new Set([...bare].filter((c) => isKanjiChar(c) && c !== "々" && !allowedKanji.has(c)))];
    if (outside.length) problems.push(`kanji above level: ${outside.join("")}`);
  }
  return problems;
}
