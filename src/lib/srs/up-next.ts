/**
 * What comes after a session (F_ReviewDone's "Up next"), and the counts behind it: the quick
 * check first while it's running (decision 6), then new items, then reviews.
 */
import { and, asc, count, eq, gte, inArray, lt, lte, min, ne, or, sql } from "drizzle-orm";

import type { DbOrTx } from "@/db/client";
import { cards, deckItems, decks, quickCheck } from "@/db/schema";
import { type StudyDate, studyDayBounds } from "@/lib/day";
import { type DayPlan, newQuotaFor, ROUTES } from "@/lib/planner/day-plan";

import { LEARNING_AHEAD_MS } from "./queue";
import type { UpNext } from "./types";


const KIND_WORDS: Record<string, [string, string]> = {
  kana: ["kana", "kana"],
  kanji: ["kanji", "kanji"],
  word: ["word", "words"],
  grammar: ["grammar point", "grammar points"],
  phrase: ["phrase", "phrases"],
};

/** "2 kanji and 12 words". */
export function describeCounts(byKind: [string, number][]): string {
  const parts = byKind
    .filter(([, n]) => n > 0)
    .map(([kind, n]) => {
      const [one, many] = KIND_WORDS[kind] ?? ["card", "cards"];
      return `${n} ${n === 1 ? one : many}`;
    });
  return parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/** New cards still to introduce today, by the deck's kind. */
export async function newCardsLeft(db: DbOrTx, plan: DayPlan, date: StudyDate): Promise<[string, number][]> {
  const deckRows = await db
    .select({ id: decks.id, kind: decks.kind })
    .from(decks)
    .orderBy(asc(decks.position), asc(decks.id));
  const left = new Map<string, number>();
  for (const deck of deckRows) {
    const quota = newQuotaFor(plan, deck.id);
    if (quota === 0) continue;
    const inDeck = sql`exists (select 1 from ${deckItems} where ${deckItems.itemId} = ${cards.itemId} and ${deckItems.deckId} = ${deck.id})`;
    const [done] = await db
      .select({ n: count() })
      .from(cards)
      .where(and(eq(cards.introducedOn, date), inDeck));
    const [available] = await db
      .select({ n: count() })
      .from(cards)
      .where(and(eq(cards.state, "new"), eq(cards.status, "active"), inDeck));
    const n = Math.min(Math.max(0, quota - (done?.n ?? 0)), available?.n ?? 0);
    const kind = deck.kind ?? "word";
    left.set(kind, (left.get(kind) ?? 0) + n);
  }
  return [...left.entries()];
}

/** Items checked in the quick check during this study day. */
export async function checkedToday(db: DbOrTx, date: StudyDate): Promise<number> {
  const { start, end } = studyDayBounds(date);
  const [row] = await db
    .select({ n: count() })
    .from(quickCheck)
    .where(and(gte(quickCheck.checkedAt, start), lt(quickCheck.checkedAt, end)));
  return row?.n ?? 0;
}

/** Cards a review session opened now would load, and when the next one after those is due. */
export async function dueCounts(db: DbOrTx, now: Date, date: StudyDate): Promise<{ due: number; nextDueAt: Date | null }> {
  const dueNow = or(
    and(inArray(cards.state, ["learning", "relearning"]), lte(cards.dueAt, new Date(now.getTime() + LEARNING_AHEAD_MS))),
    and(eq(cards.state, "review"), lt(cards.dueAt, studyDayBounds(date).end)),
  );
  const [due] = await db
    .select({ n: count() })
    .from(cards)
    .where(and(eq(cards.status, "active"), dueNow));
  const [next] = await db
    .select({ at: min(cards.dueAt) })
    .from(cards)
    .where(and(eq(cards.status, "active"), ne(cards.state, "new")));
  return { due: due?.n ?? 0, nextDueAt: next?.at ?? null };
}

const taskMinutes = (plan: DayPlan, kind: string) => plan.tasks.find((t) => t.kind === kind)?.minutes ?? null;

export async function upNextAfter(
  db: DbOrTx,
  options: { after: "review" | "new" | "quick_check"; plan: DayPlan | null; date: StudyDate; now?: Date },
): Promise<UpNext | null> {
  const { plan, date, after } = options;
  if (plan && after !== "quick_check" && plan.quickCheckTarget > 0) {
    const left = plan.quickCheckTarget - (await checkedToday(db, date));
    if (left > 0) {
      return { title: "Quick check", detail: `${left} items left today · about ${Math.max(1, Math.round(left / 17))} min`, href: ROUTES.quickCheck };
    }
  }
  if (plan && after !== "new") {
    const byKind = await newCardsLeft(db, plan, date);
    const left = byKind.reduce((sum, [, n]) => sum + n, 0);
    if (left > 0) {
      const planned = Object.values(plan.newQuota).reduce((a, b) => a + b, 0);
      const minutes = taskMinutes(plan, "new_items");
      const estimate = minutes && planned ? Math.max(1, Math.round((minutes * left) / planned)) : left;
      return { title: "New items", detail: `${describeCounts(byKind)} · ${estimate} min`, href: ROUTES.newItems };
    }
  }
  if (after !== "review") {
    const { due } = await dueCounts(db, options.now ?? new Date(), date);
    if (due > 0) return { title: "Reviews", detail: `${due} ${due === 1 ? "card" : "cards"} due`, href: ROUTES.review };
  }
  return null;
}
