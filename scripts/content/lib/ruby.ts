/**
 * Furigana: lining up a word's reading with its kanji runs, and checking that a reading is plausible.
 *
 * "食べる" read "たべる" lines up one way: 食 = た. "引き出し" read "ひきだし": 引 = ひ, 出 = だ. When a
 * word lines up more than one way, the kanji readings from KANJIDIC pick the plausible one, and
 * when that still doesn't settle it, we give up rather than guess.
 */
import { hasKanji, isKanjiChar, splitRuns, toHiragana } from "./jp";
import type { KanjiData } from "./load";

/** Every way to share `reading` out across the kanji runs of `word` (kana must match exactly). */
export function alignments(word: string, reading: string): string[][] {
  const runs = splitRuns(word);
  const r = toHiragana(reading);
  const out: string[][] = [];
  const acc: string[] = [];
  const go = (i: number, pos: number) => {
    if (out.length > 50) return;
    if (i === runs.length) {
      if (pos === r.length) out.push([...acc]);
      return;
    }
    const run = runs[i];
    if (!run.kanji) {
      const t = toHiragana(run.text);
      if (r.startsWith(t, pos)) go(i + 1, pos + t.length);
      return;
    }
    for (let end = pos + 1; end <= r.length; end++) {
      acc.push(r.slice(pos, end));
      go(i + 1, end);
      acc.pop();
    }
  };
  go(0, 0);
  return out;
}

// ---------------------------------------------------------------------------
// Kanji readings

const VOICED: Record<string, string[]> = {
  か: ["が"], き: ["ぎ"], く: ["ぐ"], け: ["げ"], こ: ["ご"],
  さ: ["ざ"], し: ["じ"], す: ["ず"], せ: ["ぜ"], そ: ["ぞ"],
  た: ["だ"], ち: ["ぢ", "じ"], つ: ["づ", "ず"], て: ["で"], と: ["ど"],
  は: ["ば", "ぱ"], ひ: ["び", "ぴ"], ふ: ["ぶ", "ぷ"], へ: ["べ", "ぺ"], ほ: ["ぼ", "ぽ"],
};

/** A reading with the sound changes it can take inside a word: rendaku (か→が) and a small っ. */
function variants(reading: string): string[] {
  const out = new Set([reading]);
  for (const v of VOICED[reading[0]] ?? []) out.add(v + reading.slice(1));
  for (const r of [...out]) if (r.length > 1 && /[つくちきり]$/.test(r)) out.add(`${r.slice(0, -1)}っ`);
  return [...out];
}

export type KanjiReadings = Map<string, Set<string>>;

/** Each kanji's readings in hiragana with their sound changes: on readings, kun stems and full kun. */
export function kanjiReadings(data: Map<string, KanjiData>): KanjiReadings {
  const out: KanjiReadings = new Map();
  for (const [kanji, d] of data) {
    const set = new Set<string>();
    for (const on of d.readings_on) for (const v of variants(toHiragana(on.replace(/-/g, "")))) set.add(v);
    for (const kun of d.readings_kun) {
      const clean = toHiragana(kun.replace(/-/g, ""));
      const [stem, okuri = ""] = clean.split(".");
      for (const v of variants(stem)) set.add(v);
      // Some words keep part of the okurigana inside the kanji run: 気持 + ち, 受付 (うけつけ).
      if (okuri) for (let i = 1; i <= okuri.length; i++) for (const v of variants(stem + okuri.slice(0, i))) set.add(v);
    }
    out.set(kanji, set);
  }
  return out;
}

/** True when a kanji run can be read this way one kanji at a time (々 repeats the one before). */
export function plausible(run: string, reading: string, kr: KanjiReadings): boolean {
  const chars = [...run];
  const r = toHiragana(reading);
  const memo = new Map<string, boolean>();
  const go = (i: number, pos: number): boolean => {
    if (i === chars.length) return pos === r.length;
    const key = `${i}:${pos}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    const c = chars[i] === "々" && i > 0 ? chars[i - 1] : chars[i];
    const set = kr.get(c);
    let ok = false;
    if (set) {
      for (let end = pos + 1; end <= r.length && !ok; end++) if (set.has(r.slice(pos, end)) && go(i + 1, end)) ok = true;
    }
    memo.set(key, ok);
    return ok;
  };
  return go(0, 0);
}

/** The one plausible way to read a kanji run one kanji at a time, or null. */
export function charReadings(run: string, reading: string, kr: KanjiReadings): string[] | null {
  const chars = [...run];
  const r = toHiragana(reading);
  const found: string[][] = [];
  const acc: string[] = [];
  const go = (i: number, pos: number) => {
    if (found.length > 1) return;
    if (i === chars.length) {
      if (pos === r.length) found.push([...acc]);
      return;
    }
    const c = chars[i] === "々" && i > 0 ? chars[i - 1] : chars[i];
    const set = kr.get(c);
    if (!set) return;
    for (let end = pos + 1; end <= r.length; end++) {
      if (!set.has(r.slice(pos, end))) continue;
      acc.push(r.slice(pos, end));
      go(i + 1, end);
      acc.pop();
    }
  };
  go(0, 0);
  return found.length === 1 ? found[0] : null;
}

/** The one sensible split of a word's reading over its kanji runs, or null. */
export function runReadings(word: string, reading: string, kr: KanjiReadings): string[] | null {
  const all = alignments(word, reading);
  if (all.length === 1) return all[0];
  if (all.length === 0) return null;
  const kanjiRuns = splitRuns(word).filter((r) => r.kanji).map((r) => r.text);
  const ok = all.filter((a) => a.every((part, i) => plausible(kanjiRuns[i], part, kr)));
  return ok.length === 1 ? ok[0] : null;
}

/** Ruby markup for a word and its reading: ("食べる", "たべる") → "{食|た}べる". Null if unsure. */
export function rubyWord(word: string, reading: string, kr: KanjiReadings): string | null {
  if (!hasKanji(word)) return word;
  const parts = runReadings(word, reading, kr);
  if (!parts) return null;
  let i = 0;
  return splitRuns(word)
    .map((run) => (run.kanji ? `{${run.text}|${parts[i++]}}` : run.text))
    .join("");
}

/** Kanji in the text that are not inside a ruby base. */
export function kanjiWithoutRuby(markup: string): string[] {
  return [...markup.replace(/\{[^{}|]+\|[^{}|]+\}/g, "")].filter(isKanjiChar);
}
