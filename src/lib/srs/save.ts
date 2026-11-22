/**
 * Saving grades on the server: /api/reviews (grades, undo, quick check verdicts) and wrong quiz
 * answers (round 2). The server re-runs FSRS from the stored card, and writes the card and its
 * log in one transaction. The card's FSRS state and its column copies go in one statement.
 */
import { and, count, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import type { Db, DbOrTx } from "@/db/client";
import { cards, items, quickCheck, reviewLogs } from "@/db/schema";
import { getSettings } from "@/db/settings";
import { addDays, daysBetween, type StudyDate, studyDate, studyDayBounds } from "@/lib/day";

import { type CheckOp, type GradeOp, Op, type OpResult, type OpStatus, type UndoOp } from "./ops";
import { type Grade, gradeCard, type Scheduler, schedulerFor, type StoredFsrs } from "./scheduler";
import { KNOWN_FIRST_DAY, pickSpreadDay } from "./spread";

type CardRow = typeof cards.$inferSelect;
type Source = (typeof reviewLogs.$inferInsert)["source"];

/** Moving a card to the front of the new queue takes this off its rank. */
export const FRONT_OF_QUEUE = 1_000_000;
/** A grade may be stamped a little ahead of the server's clock; further ahead, it's the server's time. */
const CLOCK_SKEW_MS = 2 * 60_000;
/** Serialises quick-check placements, so the per-day cap holds when two requests overlap. */
const QUICK_CHECK_LOCK = 4_242_001;

/** Applies a batch from the outbox in order, each op in its own transaction. */
export async function saveOps(db: Db, rawOps: unknown[], now: Date = new Date()): Promise<OpResult[]> {
  const scheduler = await schedulerFor((await getSettings(db)).fsrs);
  const results: OpResult[] = [];
  for (const raw of rawOps) {
    const parsed = Op.safeParse(raw);
    if (!parsed.success) {
      results.push({ id: idOf(raw), status: "invalid" });
      continue;
    }
    const op = parsed.data;
    const status = await db.transaction((tx) => {
      if (op.kind === "grade") return saveGrade(tx, scheduler, op, now);
      if (op.kind === "undo") return saveUndo(tx, op, now);
      return saveCheck(tx, scheduler, op, now);
    });
    results.push({ id: op.id, status });
  }
  return results;
}

function idOf(raw: unknown): string {
  const id = (raw as { id?: unknown } | null)?.id;
  return typeof id === "string" ? id : "";
}

async function saveGrade(tx: DbOrTx, scheduler: Scheduler, op: GradeOp, now: Date): Promise<OpStatus> {
  const [card] = await tx.select().from(cards).where(eq(cards.id, op.cardId)).for("update");
  if (!card) return "missing";
  // After the lock, so a retry racing its first attempt sees that attempt's log.
  if (await logExists(tx, op.id)) return "duplicate";
  if (card.lastReviewId !== op.lastReviewId) return "stale";
  await writeGrade(tx, scheduler, card, {
    id: op.id,
    grade: op.rating as Grade,
    at: reviewTime(new Date(op.reviewedAt), card.lastReviewAt, now),
    durationMs: op.durationMs,
    source: "session",
  });
  return "saved";
}

async function saveUndo(tx: DbOrTx, op: UndoOp, now: Date): Promise<OpStatus> {
  const [log] = await tx
    .select({ cardId: reviewLogs.cardId, voidedAt: reviewLogs.voidedAt, cardBefore: reviewLogs.cardBefore })
    .from(reviewLogs)
    .where(eq(reviewLogs.id, op.reviewId))
    .for("update");
  if (!log) return "missing";
  if (log.voidedAt) return "duplicate";
  const [card] = await tx
    .select({ id: cards.id, lastReviewId: cards.lastReviewId })
    .from(cards)
    .where(eq(cards.id, log.cardId))
    .for("update");
  // Only the card's last review can be undone: a later grade (on another device) built on it.
  if (!card || card.lastReviewId !== op.reviewId) return "stale";
  await tx.update(reviewLogs).set({ voidedAt: now }).where(eq(reviewLogs.id, op.reviewId));
  await tx.update(cards).set(restoreCard(log.cardBefore)).where(eq(cards.id, card.id));
  return "saved";
}

async function saveCheck(tx: DbOrTx, scheduler: Scheduler, op: CheckOp, now: Date): Promise<OpStatus> {
  await tx.execute(sql`select pg_advisory_xact_lock(${QUICK_CHECK_LOCK})`);
  const [item] = await tx.select({ id: items.id }).from(items).where(eq(items.id, op.itemId));
  if (!item) return "missing";
  if (await logExists(tx, op.id)) return "duplicate";
  const at = reviewTime(new Date(op.checkedAt), null, now);
  const row = { verdict: op.verdict, verified: op.verified, checkedAt: at };
  await tx
    .insert(quickCheck)
    .values({ itemId: op.itemId, ...row })
    .onConflictDoUpdate({ target: quickCheck.itemId, set: row });

  // Only cards not started yet: a card you've already reviewed keeps its schedule.
  const fresh = await tx
    .select()
    .from(cards)
    .where(and(eq(cards.itemId, op.itemId), eq(cards.state, "new"), eq(cards.status, "active")))
    .for("update");
  if (op.verdict === "known" && op.verified !== false) {
    const checkedOn = studyDate(at);
    const loads = await knownLoads(tx, checkedOn);
    for (const [i, card] of fresh.entries()) {
      const day = pickSpreadDay(checkedOn, loads);
      loads.set(day, (loads.get(day) ?? 0) + 1);
      await placeKnown(tx, scheduler, card, { id: i === 0 ? op.id : crypto.randomUUID(), at, day });
    }
  } else {
    // Unsure, forgot, or a "Knew it" that failed its spot check: first in line for new cards.
    await moveToFrontOfNewQueue(
      tx,
      fresh.map((c) => c.id),
    );
  }
  return "saved";
}

/** Quick-check items already put on each day from `checkedOn`'s spread onwards. */
async function knownLoads(tx: DbOrTx, checkedOn: StudyDate): Promise<Map<StudyDate, number>> {
  const from = studyDayBounds(addDays(checkedOn, KNOWN_FIRST_DAY)).start;
  const day = sql<string>`(((${cards.dueAt} at time zone 'UTC') + interval '90 minutes')::date)::text`;
  const rows = await tx
    .select({ day, n: count() })
    .from(cards)
    .innerJoin(reviewLogs, eq(reviewLogs.id, cards.lastReviewId))
    .where(and(eq(reviewLogs.source, "quick_check"), isNull(reviewLogs.voidedAt), gte(cards.dueAt, from)))
    .groupBy(day);
  return new Map(rows.map((r) => [r.day, r.n]));
}

/**
 * A known item starts as if graded Easy at the check, so FSRS gives it a long memory, but comes
 * due at the start of its spread day rather than all on the same far-off date.
 */
async function placeKnown(
  tx: DbOrTx,
  scheduler: Scheduler,
  card: CardRow,
  input: { id: string; at: Date; day: StudyDate },
) {
  const graded = gradeCard(scheduler, { cardId: card.id, fsrs: null, grade: 4, at: input.at });
  const dueAt = studyDayBounds(input.day).start;
  const stored: StoredFsrs = {
    ...graded.stored,
    dueAt: dueAt.toISOString(),
    scheduledDays: daysBetween(studyDate(input.at), input.day),
  };
  await tx.insert(reviewLogs).values({
    id: input.id,
    cardId: card.id,
    rating: 4,
    reviewedAt: input.at,
    durationMs: null,
    source: "quick_check",
    cardBefore: snapshotCard(card),
    log: graded.revlog,
  });
  await tx
    .update(cards)
    .set({
      fsrs: stored,
      ...graded.columns,
      dueAt,
      lastReviewId: input.id,
      introducedOn: card.introducedOn ?? studyDate(input.at),
    })
    .where(eq(cards.id, card.id));
}

/**
 * A wrong quiz answer (round 2): counts as Again on each of the item's cards, at most once per
 * card per study day. A card not started yet moves to the front of the new queue instead.
 */
export async function recordQuizMiss(
  db: DbOrTx,
  itemId: number,
  at: Date = new Date(),
): Promise<{ again: number[]; movedToFront: number[] }> {
  const scheduler = await schedulerFor((await getSettings(db)).fsrs);
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(cards)
      .where(and(eq(cards.itemId, itemId), eq(cards.status, "active")))
      .for("update");
    const day = studyDate(at);
    const again: number[] = [];
    const movedToFront: number[] = [];
    for (const card of rows) {
      if (card.state === "new") {
        movedToFront.push(card.id);
        continue;
      }
      const [already] = await tx
        .select({ id: reviewLogs.id })
        .from(reviewLogs)
        .where(
          and(
            eq(reviewLogs.cardId, card.id),
            eq(reviewLogs.source, "quiz"),
            eq(reviewLogs.studyDate, day),
            isNull(reviewLogs.voidedAt),
          ),
        )
        .limit(1);
      if (already) continue;
      await writeGrade(tx, scheduler, card, {
        id: crypto.randomUUID(),
        grade: 1,
        at: reviewTime(at, card.lastReviewAt, at),
        durationMs: null,
        source: "quiz",
      });
      again.push(card.id);
    }
    await moveToFrontOfNewQueue(tx, movedToFront);
    return { again, movedToFront };
  });
}

/** Puts cards not started yet ahead of the rest of the new queue (once; it doesn't stack). */
export async function moveToFrontOfNewQueue(tx: DbOrTx, cardIds: number[]): Promise<void> {
  if (cardIds.length === 0) return;
  await tx
    .update(cards)
    .set({ newRank: sql`${cards.newRank} - ${FRONT_OF_QUEUE}` })
    .where(and(inArray(cards.id, cardIds), eq(cards.state, "new"), gte(cards.newRank, 0)));
}

/** Grades a card and saves the card and its log. The caller holds the card's row lock. */
async function writeGrade(
  tx: DbOrTx,
  scheduler: Scheduler,
  card: CardRow,
  input: { id: string; grade: Grade; at: Date; durationMs: number | null; source: Source },
) {
  const graded = gradeCard(scheduler, {
    cardId: card.id,
    fsrs: card.fsrs as StoredFsrs | null,
    grade: input.grade,
    at: input.at,
  });
  await tx.insert(reviewLogs).values({
    id: input.id,
    cardId: card.id,
    rating: input.grade,
    reviewedAt: input.at,
    durationMs: input.durationMs,
    source: input.source,
    cardBefore: snapshotCard(card),
    log: graded.revlog,
  });
  await tx
    .update(cards)
    .set({
      fsrs: graded.stored,
      ...graded.columns,
      lastReviewId: input.id,
      introducedOn: card.introducedOn ?? studyDate(input.at),
    })
    .where(eq(cards.id, card.id));
}

async function logExists(tx: DbOrTx, id: string): Promise<boolean> {
  const [row] = await tx.select({ id: reviewLogs.id }).from(reviewLogs).where(eq(reviewLogs.id, id));
  return row !== undefined;
}

/**
 * When a grade counts as made: the device's time, unless that's in the future by more than a
 * little clock skew, or before the card's last review (another device's clock).
 */
export function reviewTime(at: Date, lastReviewAt: Date | null, now: Date): Date {
  let time = Number.isNaN(at.getTime()) || at.getTime() > now.getTime() + CLOCK_SKEW_MS ? now : at;
  if (lastReviewAt && time < lastReviewAt) time = lastReviewAt;
  return time;
}

// ---------------------------------------------------------------------------
// The card as it was before a grade, for undo

const SNAPSHOT = [
  "state",
  "fsrs",
  "dueAt",
  "stability",
  "difficulty",
  "reps",
  "lapses",
  "lastReviewAt",
  "lastReviewId",
  "introducedOn",
  "newRank",
] as const satisfies (keyof CardRow)[];
const DATE_FIELDS = new Set<string>(["dueAt", "lastReviewAt"]);

export function snapshotCard(card: CardRow): Record<string, unknown> {
  return Object.fromEntries(
    SNAPSHOT.map((key) => {
      const value = card[key];
      return [key, value instanceof Date ? value.toISOString() : value];
    }),
  );
}

export function restoreCard(snapshot: Record<string, unknown>): Partial<CardRow> {
  return Object.fromEntries(
    SNAPSHOT.filter((key) => key in snapshot).map((key) => {
      const value = snapshot[key];
      return [key, DATE_FIELDS.has(key) && typeof value === "string" ? new Date(value) : value];
    }),
  ) as Partial<CardRow>;
}
