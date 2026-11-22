/**
 * The quick check's items (decision 6): all N5 kana, then the 80 N5 kanji, then the 718 N5 words,
 * each once, over the first 3 days. Verdicts are saved through the outbox (src/lib/srs/save.ts).
 */
import { and, asc, count, eq, gte, inArray, lt, min, notExists, exists, sql } from "drizzle-orm";

import type { DbOrTx } from "@/db/client";
import { cards, deckItems, decks, items, quickCheck } from "@/db/schema";
import { daysBetween, type StudyDate, studyDate, studyDayBounds } from "@/lib/day";

/** The starter decks it covers, kana first. */
export const QUICK_CHECK_DECKS = ["hiragana", "katakana", "n5-kanji", "n5-words"];
export const QUICK_CHECK_DAYS = 3;

export type CheckItem = {
  itemId: number;
  kind: "kana" | "kanji" | "word";
  term: string;
  reading: string | null;
  meaning: string;
  /** Kana: hiragana or katakana. */
  script: string | null;
  /** Kana: other romaji that count as right. */
  accept: string[];
  /** Words: the example sentence. */
  example: { ja: string; en: string } | null;
};

export type QuickCheckProgress = {
  /** Items in the quick check, and how many are checked. */
  total: number;
  checked: number;
  checkedToday: number;
  /** Day 1, 2 or 3 (or later, if it runs over). */
  day: number;
};

const inQuickCheckDeck = and(eq(deckItems.itemId, items.id), inArray(decks.slug, QUICK_CHECK_DECKS));

export async function quickCheckProgress(db: DbOrTx, date: StudyDate): Promise<QuickCheckProgress> {
  const scope = exists(
    db
      .select({ one: sql`1` })
      .from(deckItems)
      .innerJoin(decks, eq(decks.id, deckItems.deckId))
      .where(and(eq(deckItems.itemId, quickCheck.itemId), inArray(decks.slug, QUICK_CHECK_DECKS))),
  );
  const [[total], [checked], [today]] = await Promise.all([
    db
      .select({ n: count() })
      .from(deckItems)
      .innerJoin(decks, eq(decks.id, deckItems.deckId))
      .where(inArray(decks.slug, QUICK_CHECK_DECKS)),
    db.select({ n: count(), first: min(quickCheck.checkedAt) }).from(quickCheck).where(scope),
    db
      .select({ n: count() })
      .from(quickCheck)
      .where(and(scope, gte(quickCheck.checkedAt, studyDayBounds(date).start), lt(quickCheck.checkedAt, studyDayBounds(date).end))),
  ]);
  const first = checked?.first ? studyDate(checked.first) : null;
  return {
    total: total?.n ?? 0,
    checked: checked?.n ?? 0,
    checkedToday: today?.n ?? 0,
    day: first ? daysBetween(first, date) + 1 : 1,
  };
}

/** The next items to check, in order: not checked yet, and not started as cards already. */
export async function loadQuickCheckItems(db: DbOrTx, limit: number): Promise<CheckItem[]> {
  if (limit <= 0) return [];
  const rows = await db
    .select({
      itemId: items.id,
      kind: items.kind,
      term: items.term,
      reading: items.reading,
      meaning: items.meaning,
      data: items.data,
    })
    .from(items)
    .innerJoin(deckItems, eq(deckItems.itemId, items.id))
    .innerJoin(decks, eq(decks.id, deckItems.deckId))
    .where(
      and(
        inQuickCheckDeck,
        notExists(db.select({ one: sql`1` }).from(quickCheck).where(eq(quickCheck.itemId, items.id))),
        exists(
          db
            .select({ one: sql`1` })
            .from(cards)
            .where(and(eq(cards.itemId, items.id), eq(cards.state, "new"), eq(cards.status, "active"))),
        ),
      ),
    )
    .orderBy(asc(decks.position), asc(deckItems.position), asc(items.id))
    .limit(limit);
  return rows.map((r) => {
    const data = (r.data ?? {}) as Record<string, unknown>;
    const ex = (data.example ?? null) as { ja?: unknown; en?: unknown } | null;
    return {
      itemId: r.itemId,
      kind: r.kind as CheckItem["kind"],
      term: r.term,
      reading: r.reading,
      meaning: r.meaning,
      script: typeof data.script === "string" ? data.script : null,
      accept: Array.isArray(data.accept) ? data.accept.filter((a): a is string => typeof a === "string") : [],
      example: ex && typeof ex.ja === "string" ? { ja: ex.ja, en: typeof ex.en === "string" ? ex.en : "" } : null,
    };
  });
}

/** Meanings of other N5 kanji and words, for the spot check's wrong options. */
export async function spotCheckMeanings(db: DbOrTx): Promise<{ kanji: string[]; word: string[] }> {
  const pick = (slug: string) =>
    db
      .select({ meaning: items.meaning })
      .from(items)
      .innerJoin(deckItems, eq(deckItems.itemId, items.id))
      .innerJoin(decks, and(eq(decks.id, deckItems.deckId), eq(decks.slug, slug)))
      .orderBy(sql`random()`)
      .limit(40);
  const [kanji, word] = await Promise.all([pick("n5-kanji"), pick("n5-words")]);
  return { kanji: kanji.map((r) => r.meaning), word: word.map((r) => r.meaning) };
}
