/** JMdict (through jmdict-simplified): loading, an index by written form, and part-of-speech mapping. */
import { readFileSync } from "node:fs";

import type { Pos } from "../../../content/schema";
import { toHiragana } from "./jp";
import { ensureSource } from "./sources";

type Tagged = { text: string; common: boolean; tags: string[] };
export type JmKana = Tagged & { appliesToKanji: string[] };
export type JmSense = {
  partOfSpeech: string[];
  appliesToKanji: string[];
  appliesToKana: string[];
  misc: string[];
  gloss: { lang: string; text: string }[];
};
export type JmWord = { id: string; kanji: Tagged[]; kana: JmKana[]; sense: JmSense[] };

export async function loadJmdict(which: "common" | "full"): Promise<JmWord[]> {
  const file = await ensureSource(which === "common" ? "jmdictCommon" : "jmdictFull");
  const data = JSON.parse(readFileSync(file, "utf8")) as { version: string; words: JmWord[] };
  if (data.version !== "3.6.2") throw new Error(`Expected jmdict-simplified 3.6.2, got ${data.version}`);
  return data.words;
}

/** Forms that are only there for search, or are old or irregular spellings. */
const HIDDEN_FORM = new Set(["sK", "sk", "oK", "ok", "iK", "ik", "rK", "rk"]);
export const isShownForm = (f: Tagged) => !f.tags.some((t) => HIDDEN_FORM.has(t));

/** Kana forms that go with a written form. */
export function kanaFor(word: JmWord, kanji: string | null): JmKana[] {
  return word.kana.filter((k) => kanji === null || k.appliesToKanji.includes("*") || k.appliesToKanji.includes(kanji));
}

export function sensesFor(word: JmWord, kanji: string | null, kana: string): JmSense[] {
  return word.sense.filter(
    (s) =>
      (kanji === null || s.appliesToKanji.includes("*") || s.appliesToKanji.includes(kanji)) &&
      (s.appliesToKana.includes("*") || s.appliesToKana.includes(kana)),
  );
}

export class JmIndex {
  readonly byKanji = new Map<string, JmWord[]>();
  readonly byKana = new Map<string, JmWord[]>();
  readonly byId = new Map<string, JmWord>();

  constructor(readonly words: JmWord[]) {
    for (const w of words) {
      this.byId.set(w.id, w);
      for (const k of w.kanji) push(this.byKanji, k.text, w);
      for (const k of w.kana) push(this.byKana, toHiragana(k.text), w);
    }
  }

  /** Readings (in hiragana) of a written form across all entries, leaving out hidden forms. */
  readingsOf(written: string): Set<string> {
    const out = new Set<string>();
    for (const w of this.byKanji.get(written) ?? []) {
      const kanji = w.kanji.find((k) => k.text === written);
      if (!kanji || !isShownForm(kanji)) continue;
      for (const k of kanaFor(w, written)) if (isShownForm(k)) out.add(toHiragana(k.text));
    }
    return out;
  }

  /** Readings of a written form that some entry marks as common. */
  commonReadingsOf(written: string): Set<string> {
    const out = new Set<string>();
    for (const w of this.byKanji.get(written) ?? []) {
      if (!w.kanji.some((k) => k.text === written && k.common)) continue;
      for (const k of kanaFor(w, written)) if (k.common && isShownForm(k)) out.add(toHiragana(k.text));
    }
    return out;
  }

  /** True when some entry is written this way and read this way. */
  has(written: string, reading: string): boolean {
    const r = toHiragana(reading);
    return (this.byKanji.get(written) ?? []).some((w) => kanaFor(w, written).some((k) => toHiragana(k.text) === r));
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) {
    if (!list.includes(value)) list.push(value);
  } else map.set(key, [value]);
}

// ---------------------------------------------------------------------------
// Parts of speech

/** JMdict part-of-speech tags to the app's `POS`. Tags not listed (vt, vi, unc…) add nothing. */
export function mapPos(tag: string): Pos | null {
  if (tag === "n" || tag === "n-pr" || tag === "n-t" || tag === "n-adv") return "noun";
  if (tag === "pn") return "pronoun";
  if (tag === "v1" || tag === "v1-s") return "verb-ichidan";
  if (tag.startsWith("v5")) return "verb-godan";
  if (tag === "vs" || tag === "vs-i" || tag === "vs-s" || tag === "vs-c") return "verb-suru";
  if (tag === "vk") return "verb-kuru";
  if (tag === "vz" || tag === "vn" || tag === "vr" || tag === "v-unspec" || tag.startsWith("v2") || tag.startsWith("v4")) return "verb-other";
  if (tag === "adj-i" || tag === "adj-ix") return "i-adj";
  if (tag === "adj-na") return "na-adj";
  if (tag === "adj-no") return "no-adj";
  if (tag === "adv" || tag === "adv-to") return "adverb";
  if (tag === "prt") return "particle";
  if (tag === "conj") return "conjunction";
  if (tag === "ctr") return "counter";
  if (tag === "num") return "numeric";
  if (tag === "pref" || tag === "n-pref") return "prefix";
  if (tag === "suf" || tag === "n-suf") return "suffix";
  if (tag === "aux" || tag === "aux-v" || tag === "aux-adj" || tag === "cop") return "auxiliary";
  if (tag === "exp") return "expression";
  if (tag === "int") return "interjection";
  if (tag === "adj-pn" || tag === "adj-t" || tag === "adj-f" || tag === "adj-ku" || tag === "adj-shiku" || tag === "adj-nari" || tag === "adj-kari")
    return "other";
  return null;
}

/** Parts of speech of some senses, deduplicated, in the order of `POS`. */
export function posOf(senses: JmSense[], order: readonly Pos[]): Pos[] {
  const set = new Set<Pos>();
  for (const s of senses) for (const t of s.partOfSpeech) {
    const p = mapPos(t);
    if (p) set.add(p);
  }
  return order.filter((p) => set.has(p));
}
