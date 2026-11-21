/** Kanji for N5 / N4 / N3 (80 / 166 / 367) and every jōyō kanji (2,136), from kanji-data (KANJIDIC2). */
import { LEVELS, type Kanji, type KanjiInfo, type Level, type Word } from "../../content/schema";
import { splitRuns, toKatakana } from "./lib/jp";
import { type KanjiData, kanjiLevel } from "./lib/load";
import { charReadings, type KanjiReadings, runReadings } from "./lib/ruby";

/** Words that keep their capital letter when the meanings are lower-cased. */
const PROPER = new Set(
  "Japan Japanese China Chinese Korea Korean Buddha Buddhist Buddhism Shinto Confucius Confucian America American England English Britain British Europe European Asia Asian India Indian Holland Dutch France French Germany German Spain Spanish Portugal Portuguese Russia Russian Italy Italian Africa Australia Mongolia Mongolian Tokyo Kyoto Osaka Edo Kyushu Hokkaido Ainu Sanskrit Christ Christian Jesus Sunday Monday Tuesday Wednesday Thursday Friday Saturday January February March April May June July August September October November December Mt. Mr. Mrs. Ms. Dr. Ryukyu Okinawa Yamato Taoism Tao Zen Ise Shikoku Honshu Manchuria Siberia Vietnam Thailand Burma Persia Arabia Greece Greek Rome Roman Latin Egypt Mexico Peru Brazil Canada Iran Iraq Turkey Israel Netherlands Belgium Sweden Norway Denmark Poland Hungary Austria Switzerland Mars Venus Jupiter Saturn Mercury".split(
    " ",
  ),
);

/** kanji-data title-cases KANJIDIC2's meanings; this restores lower case and drops radical names. */
export function cleanMeanings(meanings: string[]): string[] {
  const out = meanings
    .filter((m) => !/radical \(no/i.test(m))
    .map((m) =>
      m
        .split(/(\s+|-|\/)/)
        .map((w) => (PROPER.has(w) || /^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase()))
        .join(""),
    );
  return [...new Set(out.length ? out : meanings.map((m) => m.toLowerCase()))];
}

const kun = (k: string) => k;
const on = (o: string) => toKatakana(o);

/** The reading a kanji takes inside a word, when the word splits cleanly. */
function readingIn(word: Word, kanji: string, kr: KanjiReadings): string | null {
  const parts = runReadings(word.term, word.reading, kr);
  if (!parts) return null;
  let i = 0;
  for (const run of splitRuns(word.term)) {
    if (!run.kanji) continue;
    const r = parts[i++];
    const at = [...run.text].indexOf(kanji);
    if (at < 0) continue;
    if (run.text.length === 1) return r;
    return charReadings(run.text, r, kr)?.[at] ?? null;
  }
  return null;
}

/** Up to two example words: at or below the kanji's level, short, and if possible read two ways. */
function examplesFor(kanji: string, level: Level, words: Word[], kr: KanjiReadings) {
  const rank = LEVELS.indexOf(level);
  const pool = words
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => w.term.includes(kanji))
    .map(({ w, i }) => {
      const above = Math.max(0, LEVELS.indexOf(w.level) - rank);
      const len = [...w.term.replace(/〜/g, "")].length;
      // A word that reads only as a whole (明日 あした) doesn't show the kanji's own reading.
      const whole = readingIn(w, kanji, kr) === null ? 5 : 0;
      return { w, score: above * 10 + Math.abs(len - 2) * 2 + (w.term.includes("〜") ? 3 : 0) + whole, i };
    })
    .sort((a, b) => a.score - b.score || a.i - b.i);
  if (pool.length === 0) return [];
  const first = pool[0].w;
  const firstReading = readingIn(first, kanji, kr);
  const second =
    pool.slice(1).find((p) => firstReading && readingIn(p.w, kanji, kr) && readingIn(p.w, kanji, kr) !== firstReading)?.w ?? pool[1]?.w;
  return [first, second]
    .filter((w): w is Word => w !== undefined)
    .map((w) => ({ term: w.term, reading: w.reading, meaning: w.meanings[0] }));
}

export function buildKanji(data: Map<string, KanjiData>, words: Word[], kr: KanjiReadings, lookalikeGroups: string[][]): Kanji[] {
  const rows: { kanji: string; level: Level; d: KanjiData }[] = [];
  for (const [kanji, d] of data) {
    const level = kanjiLevel(kanji, d);
    if (level) rows.push({ kanji, level, d });
  }
  rows.sort(
    (a, b) =>
      LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) ||
      (a.d.freq ?? 1e9) - (b.d.freq ?? 1e9) ||
      a.kanji.codePointAt(0)! - b.kanji.codePointAt(0)!,
  );
  const inSet = new Set(rows.map((r) => r.kanji));
  const looks = new Map<string, Set<string>>();
  for (const group of lookalikeGroups) {
    for (const a of group) for (const b of group) {
      if (a === b || !inSet.has(a) || !inSet.has(b)) continue;
      if (!looks.has(a)) looks.set(a, new Set());
      looks.get(a)!.add(b);
    }
  }
  return rows.map(({ kanji, level, d }) => ({
    slug: `kanji:${kanji}`,
    kanji,
    level,
    meanings: cleanMeanings(d.meanings),
    on: d.readings_on.map(on),
    kun: d.readings_kun.map(kun),
    strokes: d.strokes,
    examples: examplesFor(kanji, level, words, kr),
    lookalikes: [...(looks.get(kanji) ?? [])],
  }));
}

/** Jōyō kanji are grades 1–6 (taught in primary school) and 8 (the rest of the jōyō list). */
export function buildKanjiInfo(data: Map<string, KanjiData>): KanjiInfo[] {
  const out: KanjiInfo[] = [];
  for (const [kanji, d] of data) {
    if (d.grade === null || d.grade < 1 || d.grade > 8) continue;
    out.push({
      kanji,
      meanings: cleanMeanings(d.meanings),
      on: d.readings_on.map(on),
      kun: d.readings_kun.map(kun),
      strokes: d.strokes,
      grade: d.grade,
      jlpt: kanjiLevel(kanji, d),
    });
  }
  return out.sort(
    (a, b) => (a.grade ?? 9) - (b.grade ?? 9) || (data.get(a.kanji)!.freq ?? 1e9) - (data.get(b.kanji)!.freq ?? 1e9) || a.kanji.codePointAt(0)! - b.kanji.codePointAt(0)!,
  );
}
