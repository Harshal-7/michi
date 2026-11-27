/**
 * Typed vocabulary practice on the server: a level's words with what the answer checker needs,
 * each word's progress both ways, the per-level counts, and saving answers. Practice keeps its
 * own counts in `vocab_progress` and never touches a card or its review schedule.
 */
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db/client";
import { deckItems, decks, dictionary, items, vocabProgress } from "@/db/schema";

import { normalizeMeaning } from "./match";
import { type Direction, DIRECTIONS, type Level, type Progress, VOCAB_LEVELS, type VocabWord } from "./types";

/** At most this many same-meaning words per word, so a meaning like "to be" can't swell the page. */
const MAX_OTHERS = 8;

type WordRow = { id: number; term: string; reading: string | null; data: Record<string, unknown> };

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s !== "") : []);

/** The example as the card back reads it: the sentence, its English and the Tatoeba id for the credit. */
function example(v: unknown): VocabWord["example"] {
  const o = (v ?? {}) as Record<string, unknown>;
  if (typeof o.ja !== "string" || !o.ja) return null;
  const tatoeba = (o.tatoeba ?? {}) as Record<string, unknown>;
  return {
    ja: o.ja,
    en: typeof o.en === "string" ? o.en : "",
    ...(o.source === "tatoeba" && typeof tatoeba.ja === "number" ? { source: "tatoeba", tatoeba: { ja: tatoeba.ja } } : {}),
  };
}

/** Every word item, grouped by each of its meanings, for "another word with the same meaning". */
function byMeaning(rows: WordRow[]): Map<string, WordRow[]> {
  const groups = new Map<string, WordRow[]>();
  for (const row of rows) {
    for (const key of new Set(strings(row.data.meanings).map(normalizeMeaning))) {
      if (!key) continue;
      const group = groups.get(key);
      if (group) group.push(row);
      else groups.set(key, [row]);
    }
  }
  return groups;
}

/**
 * A level's words in list order (the order of its starter deck), with their progress, their
 * other written forms from the dictionary, and other words that share a meaning.
 */
export async function loadVocab(db: Db, level: Level): Promise<VocabWord[]> {
  const deck = `${level.toLowerCase()}-words`;
  const [rows, all] = await Promise.all([
    db
      .select({ id: items.id, term: items.term, reading: items.reading, data: items.data })
      .from(items)
      .leftJoin(decks, eq(decks.slug, deck))
      .leftJoin(deckItems, and(eq(deckItems.deckId, decks.id), eq(deckItems.itemId, items.id)))
      .where(and(eq(items.kind, "word"), eq(items.level, level)))
      .orderBy(sql`${deckItems.position} asc nulls last`, asc(items.id)),
    db.select({ id: items.id, term: items.term, reading: items.reading, data: items.data }).from(items).where(eq(items.kind, "word")),
  ]);
  if (rows.length === 0) return [];
  const words = rows as WordRow[];
  const ids = rows.map((r) => r.id);
  const jmdictIds = [...new Set(words.map((r) => r.data.jmdictId).filter((v): v is string => typeof v === "string"))];
  const [progress, entries] = await Promise.all([
    db.select().from(vocabProgress).where(inArray(vocabProgress.itemId, ids)),
    jmdictIds.length
      ? db.select({ id: dictionary.id, kanji: dictionary.kanji, kana: dictionary.kana }).from(dictionary).where(inArray(dictionary.id, jmdictIds))
      : [],
  ]);
  const progressOf = new Map<number, Partial<Record<Direction, Progress>>>();
  for (const p of progress) {
    const mine = progressOf.get(p.itemId) ?? {};
    mine[p.direction] = { right: p.right, wrong: p.wrong, lastRight: p.lastRight };
    progressOf.set(p.itemId, mine);
  }
  const entryOf = new Map(entries.map((e) => [e.id, [...e.kanji, ...e.kana]]));
  const groups = byMeaning(all as WordRow[]);

  return words.map((r) => {
    const reading = r.reading ?? r.term;
    const meanings = strings(r.data.meanings);
    const jmdictId = typeof r.data.jmdictId === "string" ? r.data.jmdictId : null;
    const forms = (jmdictId ? (entryOf.get(jmdictId) ?? []) : []).filter((f) => f !== r.term && f !== reading);
    const others = new Map<number, VocabWord["others"][number]>();
    for (const key of new Set(meanings.map(normalizeMeaning))) {
      for (const o of groups.get(key) ?? []) {
        if (others.size >= MAX_OTHERS) break;
        if (o.id === r.id || others.has(o.id) || (o.reading ?? o.term) === reading) continue;
        others.set(o.id, { term: o.term, reading: o.reading ?? o.term, meaning: strings(o.data.meanings).slice(0, 2).join("; ") });
      }
    }
    const mine = progressOf.get(r.id) ?? {};
    return {
      id: r.id,
      term: r.term,
      reading,
      meanings,
      pos: strings(r.data.pos),
      usuallyKana: r.data.usuallyKana === true,
      example: example(r.data.example),
      forms,
      others: [...others.values()],
      progress: { ja_en: mine.ja_en ?? null, en_ja: mine.en_ja ?? null },
    };
  });
}

export type LevelCounts = Record<Level, { total: number } & Record<Direction, number>>;

/** Each level's word count and how many have been typed right at least once, each way. */
export async function levelCounts(db: Db): Promise<LevelCounts> {
  const [totals, typed] = await Promise.all([
    db.select({ level: items.level, n: count() }).from(items).where(eq(items.kind, "word")).groupBy(items.level),
    db
      .select({ level: items.level, direction: vocabProgress.direction, n: count() })
      .from(vocabProgress)
      .innerJoin(items, eq(items.id, vocabProgress.itemId))
      .where(and(eq(items.kind, "word"), sql`${vocabProgress.right} > 0`))
      .groupBy(items.level, vocabProgress.direction),
  ]);
  const out = Object.fromEntries(VOCAB_LEVELS.map((l) => [l, { total: 0, ja_en: 0, en_ja: 0 }])) as LevelCounts;
  for (const t of totals) if (t.level) out[t.level].total = t.n;
  for (const t of typed) if (t.level) out[t.level][t.direction] = t.n;
  return out;
}

// ---------------------------------------------------------------------------
// Saving

export const VocabResult = z.object({
  itemId: z.int().positive(),
  direction: z.enum(DIRECTIONS),
  /** "answer": a checked answer. "fix": "Count it as right" on a wrong answer already saved. */
  kind: z.enum(["answer", "fix"]),
  right: z.boolean(),
  /** When it was answered (a fix carries its answer's time). */
  at: z.iso.datetime({ offset: true }),
});
export type VocabResult = z.infer<typeof VocabResult>;

export const VocabResultsRequest = z.object({ results: z.array(VocabResult).min(1).max(50) });

/**
 * Adds answers to the counts, in order. A fix turns one wrong into one right. The last result
 * follows the latest answer time, so a phone that saves late doesn't overwrite a newer answer
 * from the laptop. Answers for words that no longer exist are dropped. Returns how many it saved.
 */
export async function saveVocabResults(db: Db, results: VocabResult[]): Promise<number> {
  const ids = [...new Set(results.map((r) => r.itemId))];
  const known = new Set(
    (await db.select({ id: items.id }).from(items).where(and(inArray(items.id, ids), eq(items.kind, "word")))).map((r) => r.id),
  );
  const kept = results.filter((r) => known.has(r.itemId));
  await db.transaction(async (tx) => {
    for (const r of kept) {
      const fix = r.kind === "fix";
      const rightDelta = fix || r.right ? 1 : 0;
      const wrongDelta = fix ? -1 : r.right ? 0 : 1;
      const at = new Date(r.at);
      const lastRight = fix ? true : r.right;
      await tx
        .insert(vocabProgress)
        .values({ itemId: r.itemId, direction: r.direction, right: rightDelta, wrong: Math.max(wrongDelta, 0), lastRight, lastAt: at })
        .onConflictDoUpdate({
          target: [vocabProgress.itemId, vocabProgress.direction],
          set: {
            right: sql`${vocabProgress.right} + ${rightDelta}`,
            wrong: sql`greatest(${vocabProgress.wrong} + ${wrongDelta}, 0)`,
            lastRight: sql`case when excluded.last_at >= ${vocabProgress.lastAt} then excluded.last_right else ${vocabProgress.lastRight} end`,
            lastAt: sql`greatest(excluded.last_at, ${vocabProgress.lastAt})`,
          },
        });
    }
  });
  return kept.length;
}
