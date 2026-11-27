/**
 * Putting a quiz together (decision 14): which types it holds, and which items they ask about.
 *
 * Items come from the pool (decision 2): started or marked known, plus N5 grammar points read in
 * the read-through. Each has a weight: weaker, recently missed and class items come up more, and
 * anything answered right in the last 7 days is left out before it gets here. When the pool can't
 * fill a slot, a kana question takes its place. Pure; store.ts gathers the pool.
 */
import {
  type Bank,
  grammarFillQuestion,
  kanaQuestion,
  kanjiReadingQuestion,
  listeningFallback,
  listeningQuestion,
  meaningQuestion,
  meaningReverseQuestion,
  type QGrammar,
  type QKana,
  type QKanji,
  type QWord,
  sentenceOrderQuestion,
  spellingQuestion,
  wordInContextQuestion,
} from "./builders";
import { type Random, shuffle, weightedSample } from "./random";
import type { Asked, QuizKind } from "./types";

export type Weighted<T> = { item: T; weight: number };

export type Pool = {
  words: Weighted<QWord>[];
  kanji: Weighted<QKanji>[];
  grammar: Weighted<QGrammar>[];
  /** Kana to fill in with; in the N5 phase they also get their own slot. */
  kana: Weighted<QKana>[];
};

export type Slot = "kana" | "kanji_reading" | "meaning" | "meaning_reverse" | "grammar_fill" | "spelling_or_context" | "sentence_order" | "listening";

/** The daily quiz's 10 and the weekly test's 25, in the order they're asked. */
export function slotsFor(kind: QuizKind | "listen", kanaPhase: boolean): Slot[] {
  if (kind === "listen") return Array<Slot>(5).fill("listening");
  const daily: Slot[] = [
    kanaPhase ? "kana" : "meaning",
    "kanji_reading",
    "kanji_reading",
    "meaning",
    "meaning_reverse",
    "grammar_fill",
    "grammar_fill",
    "spelling_or_context",
    "sentence_order",
    "listening",
  ];
  if (kind === "daily") return daily;
  const n = (slot: Slot, count: number) => Array<Slot>(count).fill(slot);
  return [
    ...n(kanaPhase ? "kana" : "meaning", 2),
    ...n("kanji_reading", 4),
    ...n("meaning", 3),
    ...n("meaning_reverse", 3),
    ...n("grammar_fill", 5),
    ...n("spelling_or_context", 4),
    ...n("sentence_order", 2),
    ...n("listening", 2),
  ];
}

export type Built = { asked: Asked; itemId: number };

/** How many items to try for one slot before giving up on it. */
const TRIES = 12;

export function compose(options: {
  kind: QuizKind | "listen";
  pool: Pool;
  bank: Bank;
  kanaPhase: boolean;
  hasVoice: boolean;
  random: Random;
}): Built[] {
  const { pool, bank, random, hasVoice } = options;
  const used = new Set<number>();
  const out: Built[] = [];

  const candidates = <T extends { id: number }>(list: Weighted<T>[]) =>
    weightedSample(
      list.filter((w) => !used.has(w.item.id)),
      (w) => w.weight,
      TRIES,
      random,
    ).map((w) => w.item);

  const first = <T extends { id: number }>(list: Weighted<T>[], build: (item: T) => Asked | null): Built | null => {
    for (const item of candidates(list)) {
      const asked = build(item);
      if (asked) return { asked, itemId: item.id };
    }
    return null;
  };

  const wordsAndKanji: Weighted<QWord | QKanji>[] = [...pool.words, ...pool.kanji];
  const kana = () => first(pool.kana, (k) => kanaQuestion(k, bank, random));
  const listen = (w: QWord) => (hasVoice ? listeningQuestion(w, bank, random) : listeningFallback(w, bank, random));

  const build: Record<Slot, () => Built | null> = {
    kana,
    kanji_reading: () => first(pool.words, (w) => kanjiReadingQuestion(w, bank, random)),
    meaning: () => first(wordsAndKanji, (x) => meaningQuestion(x, bank, random)),
    meaning_reverse: () => first(wordsAndKanji, (x) => meaningReverseQuestion(x, bank, random)),
    grammar_fill: () => first(pool.grammar, (g) => grammarFillQuestion(g, bank, random)),
    spelling_or_context: () =>
      first(pool.words, (w) =>
        random() < 0.5
          ? (spellingQuestion(w, bank, random) ?? wordInContextQuestion(w, bank, random))
          : (wordInContextQuestion(w, bank, random) ?? spellingQuestion(w, bank, random)),
      ),
    sentence_order: () =>
      first(pool.grammar, (g) => {
        for (const s of shuffle([...g.sentences, ...g.examples], random)) {
          const asked = sentenceOrderQuestion(s, random);
          if (asked) return asked;
        }
        return null;
      }) ?? first(pool.words, (w) => (w.example ? sentenceOrderQuestion(w.example, random) : null)),
    listening: () => first(pool.words, listen),
  };

  for (const slot of slotsFor(options.kind, options.kanaPhase)) {
    // The listen drill has no kana to fall back on: it's listening or nothing.
    const built = build[slot]() ?? (options.kind === "listen" ? null : kana());
    if (!built) continue;
    used.add(built.itemId);
    out.push(built);
  }
  return out;
}
