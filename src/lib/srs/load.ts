/**
 * Loading a session in one request: the due cards (or today's new ones) with their content.
 */
import { and, asc, count, countDistinct, desc, eq, gte, inArray, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";

import type { DbOrTx } from "@/db/client";
import { cards, deckItems, decks, itemContexts, items, reviewLogs } from "@/db/schema";
import { addDays, phaseFor, type StudyDate, studyDate, studyDayBounds } from "@/lib/day";
import { checkedSentencesFor } from "@/lib/learn/sentences";
import { type DayPlan, newQuotaFor } from "@/lib/planner/day-plan";
import type { Settings } from "@/lib/settings/schema";

import { isBacklog, LEARNING_AHEAD_MS, levelForPhase, orderQueue } from "./queue";
import { retrievability, schedulerFor, type StoredFsrs } from "./scheduler";
import type { ItemView, StudyCard } from "./types";

/** The most cards one session loads (about 300 KB). */
const SESSION_LIMIT = 1000;

const cardFields = {
  id: cards.id,
  cardType: cards.cardType,
  state: cards.state,
  fsrs: cards.fsrs,
  lastReviewId: cards.lastReviewId,
  reps: cards.reps,
  lapses: cards.lapses,
  dueAt: cards.dueAt,
  item: {
    id: items.id,
    kind: items.kind,
    level: items.level,
    term: items.term,
    reading: items.reading,
    meaning: items.meaning,
    source: items.source,
    data: items.data,
  },
};

type CardFields = {
  id: number;
  cardType: StudyCard["cardType"];
  state: StudyCard["state"];
  fsrs: Record<string, unknown> | null;
  lastReviewId: string | null;
  reps: number;
  lapses: number;
  dueAt: Date | null;
  item: Omit<ItemView, "context" | "data"> & { data: unknown };
};

/** Cards whose item is in the deck. */
const inDeck = (deckId: number) =>
  sql`exists (select 1 from ${deckItems} where ${deckItems.itemId} = ${cards.itemId} and ${deckItems.deckId} = ${deckId})`;

/**
 * Learning cards due within 20 minutes and review cards due before the next 4 am, in review
 * order. `deckId` limits it to one deck. Cards stay due whether or not their deck is on: a deck
 * switched off only stops new cards.
 */
export async function loadReviewQueue(
  db: DbOrTx,
  options: { settings: Settings; deckId?: number | null; now?: Date },
): Promise<{ cards: StudyCard[]; backlog: boolean }> {
  const now = options.now ?? new Date();
  const today = studyDate(now);
  const where: SQL[] = [
    eq(cards.status, "active"),
    or(
      and(inArray(cards.state, ["learning", "relearning"]), lte(cards.dueAt, new Date(now.getTime() + LEARNING_AHEAD_MS))),
      and(eq(cards.state, "review"), lt(cards.dueAt, studyDayBounds(today).end)),
    )!,
  ];
  if (options.deckId) where.push(inDeck(options.deckId));
  const rows: CardFields[] = await db
    .select(cardFields)
    .from(cards)
    .innerJoin(items, eq(items.id, cards.itemId))
    .where(and(...where))
    .orderBy(asc(cards.dueAt), asc(cards.id))
    .limit(SESSION_LIMIT);

  const scheduler = await schedulerFor(options.settings.fsrs);
  const reviews = rows.filter((r) => r.state === "review").length;
  const backlog = isBacklog(reviews, await recentDailyReviews(db, today));
  const entries = rows.map((row) => ({
    row,
    id: row.id,
    state: row.state,
    dueAt: row.dueAt?.toISOString() ?? null,
    level: row.item.level,
    fromClass: row.item.source === "class",
    recall: backlog ? retrievability(scheduler, row.id, row.fsrs as StoredFsrs | null, now) : 0,
  }));
  const currentLevel = levelForPhase(phaseFor(today, options.settings)?.id ?? null);
  const ordered = orderQueue(entries, { currentLevel, backlog }).map((e) => e.row);
  return { cards: await withContent(db, ordered), backlog };
}

/** The average number of session reviews on study days with any, over the last two weeks. */
async function recentDailyReviews(db: DbOrTx, today: StudyDate): Promise<number> {
  const [row] = await db
    .select({ reviews: count(), days: countDistinct(reviewLogs.studyDate) })
    .from(reviewLogs)
    .where(
      and(
        eq(reviewLogs.source, "session"),
        isNull(reviewLogs.voidedAt),
        gte(reviewLogs.studyDate, addDays(today, -14)),
        lt(reviewLogs.studyDate, today),
      ),
    );
  return row && row.days > 0 ? row.reviews / row.days : 0;
}

export type NewDeckQuota = { deckId: number; name: string; quota: number; introduced: number };

/**
 * Today's new cards: for each deck, the plan's quota less the cards already introduced today, in
 * `new_rank` order with class items first. A deck's quota counts the cards introduced today
 * from it, so leaving and coming back picks up where you stopped.
 */
export async function loadNewCards(
  db: DbOrTx,
  options: { plan: DayPlan; date: StudyDate; deckId?: number | null },
): Promise<{ cards: StudyCard[]; decks: NewDeckQuota[] }> {
  const deckRows = await db
    .select({ id: decks.id, name: decks.name })
    .from(decks)
    .orderBy(asc(decks.position), asc(decks.id));
  const wanted = deckRows
    .filter((d) => (options.deckId ? d.id === options.deckId : true))
    .map((d) => ({ deckId: d.id, name: d.name, quota: newQuotaFor(options.plan, d.id), introduced: 0 }))
    .filter((d) => d.quota > 0);

  const picked: CardFields[] = [];
  const seen = new Set<number>();
  for (const deck of wanted) {
    const [done] = await db
      .select({ n: count() })
      .from(cards)
      .where(and(eq(cards.introducedOn, options.date), inDeck(deck.deckId)));
    deck.introduced = done?.n ?? 0;
    const remaining = deck.quota - deck.introduced;
    if (remaining <= 0) continue;
    const rows: CardFields[] = await db
      .select(cardFields)
      .from(cards)
      .innerJoin(items, eq(items.id, cards.itemId))
      .innerJoin(deckItems, and(eq(deckItems.itemId, cards.itemId), eq(deckItems.deckId, deck.deckId)))
      .where(and(eq(cards.state, "new"), eq(cards.status, "active")))
      .orderBy(desc(sql`${items.source} = 'class'`), asc(cards.newRank), asc(deckItems.position), asc(cards.id))
      // A card in two decks may already be picked; ask for enough to skip those.
      .limit(remaining + seen.size);
    let taken = 0;
    for (const row of rows) {
      if (taken === remaining) break;
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      picked.push(row);
      taken++;
    }
  }
  return { cards: await withContent(db, picked), decks: wanted };
}

/**
 * Adds each item's latest "where I met it" sentence, and puts a grammar point's checked sentences
 * of your own after its examples, so they take turns on its fill-in card.
 */
async function withContent(db: DbOrTx, rows: CardFields[]): Promise<StudyCard[]> {
  const ids = [...new Set(rows.map((r) => r.item.id))];
  const mine = await checkedSentencesFor(db, [...new Set(rows.filter((r) => r.item.kind === "grammar").map((r) => r.item.id))]);
  const contexts = ids.length
    ? await db
        .selectDistinctOn([itemContexts.itemId], { itemId: itemContexts.itemId, ja: itemContexts.ja, en: itemContexts.en })
        .from(itemContexts)
        .where(inArray(itemContexts.itemId, ids))
        .orderBy(itemContexts.itemId, desc(itemContexts.createdAt))
    : [];
  const contextOf = new Map(contexts.map((c) => [c.itemId, { ja: c.ja, en: c.en }]));
  return rows.map((row) => ({
    id: row.id,
    cardType: row.cardType,
    state: row.state,
    fsrs: row.fsrs as StoredFsrs | null,
    lastReviewId: row.lastReviewId,
    reps: row.reps,
    lapses: row.lapses,
    dueAt: row.dueAt?.toISOString() ?? null,
    item: {
      ...row.item,
      data: withMine((row.item.data ?? {}) as Record<string, unknown>, mine.get(row.item.id)),
      context: contextOf.get(row.item.id) ?? null,
    },
  }));
}

function withMine(data: Record<string, unknown>, mine: { ja: string; en: string }[] | undefined): Record<string, unknown> {
  if (!mine?.length) return data;
  const examples = Array.isArray(data.examples) ? data.examples : [];
  return { ...data, examples: [...examples, ...mine] };
}
