/**
 * Items as the builders see them, from `items` rows (the seed's mapping in src/db/seed/starter.ts).
 * Items you added yourself may lack fields; they get what they have.
 */
import { glossOf } from "@/lib/learn/grammar";

import type { QGrammar, QKana, QKanji, QWord, Sentence } from "./builders";
import { readingStem } from "./kana-text";

export type ItemRow = {
  id: number;
  kind: "kana" | "kanji" | "word" | "grammar" | "phrase";
  level: string | null;
  term: string;
  reading: string | null;
  meaning: string;
  data: unknown;
};

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s !== "") : []);
const sentence = (v: unknown): Sentence | null => {
  const o = obj(v);
  return str(o.ja) ? { ja: str(o.ja), en: str(o.en) } : null;
};

export function toWord(row: ItemRow): QWord | null {
  if (row.kind !== "word" || !row.reading) return null;
  const d = obj(row.data);
  return {
    id: row.id,
    level: row.level,
    term: row.term,
    reading: row.reading,
    meaning: row.meaning,
    pos: strs(d.pos),
    usuallyKana: d.usuallyKana === true,
    example: sentence(d.example),
  };
}

export function toKanji(row: ItemRow): QKanji | null {
  if (row.kind !== "kanji") return null;
  const d = obj(row.data);
  const meanings = strs(d.meanings);
  return {
    id: row.id,
    level: row.level,
    char: row.term,
    meanings: meanings.length ? meanings : row.meaning.split(/,\s*/).filter(Boolean),
    readings: [...strs(d.on), ...strs(d.kun)].map(readingStem).filter(Boolean),
    lookalikes: strs(d.lookalikes),
  };
}

export function toKana(row: ItemRow): QKana | null {
  if (row.kind !== "kana" || !row.reading) return null;
  const d = obj(row.data);
  return {
    id: row.id,
    kana: row.term,
    romaji: row.reading,
    accept: strs(d.accept),
    script: str(d.script) || (/[ァ-ヿ]/.test(row.term) ? "katakana" : "hiragana"),
    group: str(d.group) || "basic",
    lookalikes: strs(d.lookalikes),
  };
}

export function toGrammar(row: ItemRow, sentences: Sentence[] = []): QGrammar | null {
  if (row.kind !== "grammar") return null;
  const d = obj(row.data);
  const questions = (Array.isArray(d.questions) ? d.questions : []).flatMap((q) => {
    const o = obj(q);
    const wrong = strs(o.wrong);
    return str(o.ja) && wrong.length === 3 ? [{ ja: str(o.ja), en: str(o.en), wrong, explain: str(o.explain) || undefined }] : [];
  });
  return {
    id: row.id,
    level: row.level,
    pattern: str(d.title) || row.term,
    gloss: glossOf(str(d.gloss) || undefined, row.meaning),
    examples: (Array.isArray(d.examples) ? d.examples : []).map(sentence).filter((s): s is Sentence => s !== null),
    questions,
    confusables: [],
    sentences,
  };
}
