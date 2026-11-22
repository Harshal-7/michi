/** JMdict common words (jmdict-simplified 3.6.2, 22,661 entries) for auto-fill. */
import { type DictionaryEntry, POS } from "../../content/schema";
import { isShownForm, type JmWord, posOf } from "./lib/jmdict";

/** Enough meaning for auto-fill without carrying the whole dictionary: 5 senses of up to 5 glosses. */
const MAX_SENSES = 5;
const MAX_GLOSSES = 5;

export function buildDictionary(words: JmWord[]): DictionaryEntry[] {
  return words
    .map((w) => {
      const shownKanji = w.kanji.filter(isShownForm);
      const shownKana = w.kana.filter(isShownForm);
      const byCommon = <T extends { common: boolean }>(list: T[]) => [...list.filter((f) => f.common), ...list.filter((f) => !f.common)];
      const meanings = w.sense
        .map((s) => s.gloss.filter((g) => g.lang === "eng").slice(0, MAX_GLOSSES).map((g) => g.text).join("; "))
        .filter(Boolean)
        .slice(0, MAX_SENSES);
      return {
        id: w.id,
        kanji: byCommon(shownKanji).map((k) => k.text),
        kana: byCommon(shownKana.length ? shownKana : w.kana.slice(0, 1)).map((k) => k.text),
        meanings,
        pos: posOf(w.sense, POS),
      };
    })
    .sort((a, b) => Number(a.id) - Number(b.id));
}
