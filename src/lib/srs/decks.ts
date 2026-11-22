/**
 * Decks (F_Decks): which lists are on, their pace, their cards. A deck is on when `active` is set,
 * or once `unlock_on` has come. Switching a deck off only stops new cards from it; cards already
 * started keep coming back for review.
 */
import { and, asc, count, countDistinct, eq, ne, sql } from "drizzle-orm";

import type { DbOrTx } from "@/db/client";
import { cards, deckItems, decks, items } from "@/db/schema";
import { daysBetween, type StudyDate } from "@/lib/day";

type DeckRow = typeof decks.$inferSelect;

export function isDeckOn(deck: Pick<DeckRow, "active" | "unlockOn">, today: StudyDate): boolean {
  return deck.active || (deck.unlockOn !== null && daysBetween(deck.unlockOn, today) >= 0);
}

export type DeckSummary = {
  id: number;
  name: string;
  kind: DeckRow["kind"];
  level: DeckRow["level"];
  source: DeckRow["source"];
  on: boolean;
  unlockOn: StudyDate | null;
  paceMode: DeckRow["paceMode"];
  pacePerDay: number | null;
  deadline: StudyDate | null;
  items: number;
  started: number;
};

export async function listDecks(db: DbOrTx, today: StudyDate): Promise<DeckSummary[]> {
  const started = sql<number>`count(distinct ${deckItems.itemId}) filter (where exists (
    select 1 from ${cards} where ${cards.itemId} = ${deckItems.itemId} and ${cards.state} <> 'new'))`.mapWith(Number);
  const rows = await db
    .select({
      deck: decks,
      items: countDistinct(deckItems.itemId),
      started,
    })
    .from(decks)
    .leftJoin(deckItems, eq(deckItems.deckId, decks.id))
    .groupBy(decks.id)
    .orderBy(asc(decks.position), asc(decks.id));
  return rows.map(({ deck, items: n, started: s }) => ({
    id: deck.id,
    name: deck.name,
    kind: deck.kind,
    level: deck.level,
    source: deck.source,
    on: isDeckOn(deck, today),
    unlockOn: deck.unlockOn,
    paceMode: deck.paceMode,
    pacePerDay: deck.pacePerDay,
    deadline: deck.deadline,
    items: n,
    started: s,
  }));
}

/**
 * Switches a deck on or off. Off also clears an unlock date that has already come (it would
 * keep the deck on); a future one stays, so the deck still switches on in its phase.
 */
export async function setDeckOn(db: DbOrTx, deckId: number, on: boolean, today: StudyDate): Promise<void> {
  const [deck] = await db.select().from(decks).where(eq(decks.id, deckId));
  if (!deck) return;
  const unlockPassed = deck.unlockOn !== null && daysBetween(deck.unlockOn, today) >= 0;
  await db
    .update(decks)
    .set(on ? { active: true } : { active: false, unlockOn: unlockPassed ? null : deck.unlockOn })
    .where(eq(decks.id, deckId));
}

export async function setDeckPace(
  db: DbOrTx,
  deckId: number,
  pace: { mode: "deadline" } | { mode: "per_day"; perDay: number },
): Promise<void> {
  await db
    .update(decks)
    .set(pace.mode === "deadline" ? { paceMode: "deadline" } : { paceMode: "per_day", pacePerDay: pace.perDay })
    .where(eq(decks.id, deckId));
}

export type DeckCard = {
  cardId: number;
  cardType: string;
  term: string;
  reading: string | null;
  meaning: string;
  kind: string;
  state: "new" | "learning" | "review" | "relearning";
  suspended: boolean;
  /** Days between the last review and the due date: 14 or more counts as known (the plan). */
  intervalDays: number | null;
};

export async function deckCards(db: DbOrTx, deckId: number): Promise<DeckCard[]> {
  const rows = await db
    .select({
      cardId: cards.id,
      cardType: cards.cardType,
      term: items.term,
      reading: items.reading,
      meaning: items.meaning,
      kind: items.kind,
      state: cards.state,
      status: cards.status,
      dueAt: cards.dueAt,
      lastReviewAt: cards.lastReviewAt,
    })
    .from(deckItems)
    .innerJoin(items, eq(items.id, deckItems.itemId))
    .innerJoin(cards, eq(cards.itemId, items.id))
    .where(eq(deckItems.deckId, deckId))
    .orderBy(asc(deckItems.position), asc(cards.id));
  return rows.map((r) => ({
    cardId: r.cardId,
    cardType: r.cardType,
    term: r.term,
    reading: r.reading,
    meaning: r.meaning,
    kind: r.kind,
    state: r.state,
    suspended: r.status === "suspended",
    intervalDays:
      r.dueAt && r.lastReviewAt ? Math.round((r.dueAt.getTime() - r.lastReviewAt.getTime()) / 86_400_000) : null,
  }));
}

export async function setCardSuspended(db: DbOrTx, cardId: number, suspended: boolean): Promise<void> {
  await db
    .update(cards)
    .set({ status: suspended ? "suspended" : "active" })
    .where(eq(cards.id, cardId));
}

/** Cards suspended in a deck, for its header. */
export async function suspendedCount(db: DbOrTx, deckId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(cards)
    .innerJoin(deckItems, and(eq(deckItems.itemId, cards.itemId), eq(deckItems.deckId, deckId)))
    .where(ne(cards.status, "active"));
  return row?.n ?? 0;
}
