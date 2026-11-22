import { and, eq, isNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/db/client";
import { cards, quickCheck, reviewLogs } from "@/db/schema";
import { createTestDb } from "@/db/test/test-db";
import { addDays, daysBetween, studyDate } from "@/lib/day";

import type { GradeOp } from "./ops";
import { FRONT_OF_QUEUE, recordQuizMiss, saveOps } from "./save";
import { KNOWN_FIRST_DAY, KNOWN_PER_DAY } from "./spread";
import { addCard, cardRow, resetStudyTables } from "./test-helpers";

let db: Db;
let drop: () => Promise<void>;
beforeAll(async () => ({ db, drop } = await createTestDb()));
afterAll(() => drop?.());
beforeEach(() => resetStudyTables(db));

const at = new Date("2026-12-01T03:00:00.000Z");
const later = (ms: number) => new Date(at.getTime() + ms);

function grade(cardId: number, rating: number, lastReviewId: string | null, when = at): GradeOp {
  return {
    kind: "grade",
    id: crypto.randomUUID(),
    cardId,
    rating,
    reviewedAt: when.toISOString(),
    durationMs: 4000,
    lastReviewId,
  };
}

describe("saving grades", () => {
  it("moves the due date and writes the card and its log together", async () => {
    const { cardId } = await addCard(db);
    const op = grade(cardId, 3, null);
    expect(await saveOps(db, [op], at)).toEqual([{ id: op.id, status: "saved" }]);

    const card = await cardRow(db, cardId);
    expect(card).toMatchObject({ state: "learning", reps: 1, lastReviewId: op.id, introducedOn: "2026-12-01" });
    expect(card.dueAt?.toISOString()).toBe(later(10 * 60_000).toISOString());
    // The column copies match the stored FSRS card.
    expect((card.fsrs as { dueAt: string }).dueAt).toBe(card.dueAt?.toISOString());
    const [log] = await db.select().from(reviewLogs).where(eq(reviewLogs.id, op.id));
    expect(log).toMatchObject({ cardId, rating: 3, source: "session", studyDate: "2026-12-01", durationMs: 4000 });
    expect(log.cardBefore).toMatchObject({ state: "new", fsrs: null, lastReviewId: null });

    const next = grade(cardId, 3, op.id, card.dueAt!);
    await saveOps(db, [next], card.dueAt!);
    const reviewed = await cardRow(db, cardId);
    expect(reviewed.state).toBe("review");
    expect(daysBetween(studyDate(card.dueAt!), studyDate(reviewed.dueAt!))).toBeGreaterThan(2);
  });

  it("saves a repeated grade once", async () => {
    const { cardId } = await addCard(db);
    const op = grade(cardId, 3, null);
    expect(await saveOps(db, [op, op], at)).toEqual([
      { id: op.id, status: "saved" },
      { id: op.id, status: "duplicate" },
    ]);
    expect(await saveOps(db, [op], later(60_000))).toEqual([{ id: op.id, status: "duplicate" }]);
    const logs = await db.select().from(reviewLogs).where(eq(reviewLogs.cardId, cardId));
    expect(logs).toHaveLength(1);
    expect((await cardRow(db, cardId)).reps).toBe(1);
  });

  it("drops a stale grade from a device that didn't see the last review", async () => {
    const { cardId } = await addCard(db);
    const phone = grade(cardId, 3, null);
    await saveOps(db, [phone], at);
    const before = await cardRow(db, cardId);
    // The laptop loaded the card before the phone graded it.
    const laptop = grade(cardId, 1, null, later(60_000));
    expect(await saveOps(db, [laptop], later(60_000))).toEqual([{ id: laptop.id, status: "stale" }]);
    expect(await cardRow(db, cardId)).toEqual(before);
  });

  it("keeps going past a bad op in a batch", async () => {
    const { cardId } = await addCard(db);
    const good = grade(cardId, 3, null);
    const results = await saveOps(db, [{ kind: "grade", id: "nope" }, good, grade(999_999, 3, null)], at);
    expect(results.map((r) => r.status)).toEqual(["invalid", "saved", "missing"]);
  });

  it("stamps a grade from a fast clock with the server's time", async () => {
    const { cardId } = await addCard(db);
    const op = grade(cardId, 3, null, later(3_600_000));
    await saveOps(db, [op], at);
    const [log] = await db.select().from(reviewLogs).where(eq(reviewLogs.id, op.id));
    expect(log.reviewedAt.toISOString()).toBe(at.toISOString());
  });
});

describe("undo", () => {
  it("restores the card and voids the log", async () => {
    const { cardId } = await addCard(db);
    const first = grade(cardId, 3, null);
    await saveOps(db, [first], at);
    const before = await cardRow(db, cardId);
    const second = grade(cardId, 1, first.id, before.dueAt!);
    await saveOps(db, [second], before.dueAt!);
    expect((await cardRow(db, cardId)).lapses).toBe(0);

    const undo = { kind: "undo", id: crypto.randomUUID(), reviewId: second.id };
    expect(await saveOps(db, [undo], later(3_600_000))).toEqual([{ id: undo.id, status: "saved" }]);
    const restored = await cardRow(db, cardId);
    expect({ ...restored, updatedAt: null }).toEqual({ ...before, updatedAt: null });
    const [log] = await db.select().from(reviewLogs).where(eq(reviewLogs.id, second.id));
    expect(log.voidedAt).not.toBeNull();
    // Undoing twice changes nothing more.
    expect((await saveOps(db, [undo], later(3_600_000)))[0].status).toBe("duplicate");
  });

  it("only undoes the card's last review", async () => {
    const { cardId } = await addCard(db);
    const first = grade(cardId, 3, null);
    const second = grade(cardId, 3, first.id, later(10 * 60_000));
    await saveOps(db, [first, second], later(10 * 60_000));
    const after = await cardRow(db, cardId);
    const undo = { kind: "undo", id: crypto.randomUUID(), reviewId: first.id };
    expect((await saveOps(db, [undo], later(11 * 60_000)))[0].status).toBe("stale");
    expect(await cardRow(db, cardId)).toEqual(after);
  });

  it("puts a new card back to new", async () => {
    const { cardId } = await addCard(db);
    const before = await cardRow(db, cardId);
    const op = grade(cardId, 3, null);
    await saveOps(db, [op, { kind: "undo", id: crypto.randomUUID(), reviewId: op.id }], at);
    expect({ ...(await cardRow(db, cardId)), updatedAt: null }).toEqual({ ...before, updatedAt: null });
  });
});

describe("recordQuizMiss", () => {
  it("counts as Again once per card per study day", async () => {
    const { itemId, cardId } = await addCard(db);
    await saveOps(db, [grade(cardId, 4, null)], at);
    const reviewed = await cardRow(db, cardId);
    expect(reviewed.state).toBe("review");

    expect(await recordQuizMiss(db, itemId, later(3_600_000))).toEqual({ again: [cardId], movedToFront: [] });
    const missed = await cardRow(db, cardId);
    expect(missed).toMatchObject({ state: "relearning", lapses: 1 });

    // A second miss the same study day changes nothing.
    expect(await recordQuizMiss(db, itemId, later(5 * 3_600_000))).toEqual({ again: [], movedToFront: [] });
    expect(await cardRow(db, cardId)).toEqual(missed);
    const quizLogs = await db
      .select()
      .from(reviewLogs)
      .where(and(eq(reviewLogs.cardId, cardId), eq(reviewLogs.source, "quiz")));
    expect(quizLogs).toHaveLength(1);

    // The next study day (after 4 am IST) counts again.
    const nextDay = later(24 * 3_600_000);
    expect(studyDate(nextDay)).toBe(addDays(studyDate(at), 1));
    expect((await recordQuizMiss(db, itemId, nextDay)).again).toEqual([cardId]);
  });

  it("moves an item not started yet to the front of the new queue", async () => {
    const first = await addCard(db, { newRank: 1 });
    const missed = await addCard(db, { newRank: 500 });
    expect(await recordQuizMiss(db, missed.itemId, at)).toEqual({ again: [], movedToFront: [missed.cardId] });
    const card = await cardRow(db, missed.cardId);
    expect(card).toMatchObject({ state: "new", newRank: 500 - FRONT_OF_QUEUE, lastReviewId: null });
    expect(card.newRank).toBeLessThan((await cardRow(db, first.cardId)).newRank);
    // Missing it again doesn't push it further.
    await recordQuizMiss(db, missed.itemId, at);
    expect((await cardRow(db, missed.cardId)).newRank).toBe(500 - FRONT_OF_QUEUE);
  });
});

describe("quick check", () => {
  const check = (itemId: number, verdict: "known" | "unsure" | "unknown", verified: boolean | null = null) => ({
    kind: "check" as const,
    id: crypto.randomUUID(),
    itemId,
    verdict,
    verified,
    checkedAt: at.toISOString(),
  });

  it("never puts more than 30 known items due on one day", async () => {
    const added = [];
    for (let i = 0; i < 900; i++) added.push(await addCard(db));
    for (let i = 0; i < added.length; i += 20) {
      await saveOps(
        db,
        added.slice(i, i + 20).map((a) => check(a.itemId, "known")),
        later(i * 1000),
      );
    }
    const perDay = await db
      .select({
        day: sql<string>`(((${cards.dueAt} at time zone 'UTC') + interval '90 minutes')::date)::text`,
        n: sql<number>`count(*)::int`,
      })
      .from(cards)
      .groupBy(sql`1`);
    expect(perDay.reduce((sum, d) => sum + d.n, 0)).toBe(900);
    expect(Math.max(...perDay.map((d) => d.n))).toBeLessThanOrEqual(KNOWN_PER_DAY);
    const first = perDay.map((d) => d.day).sort()[0];
    expect(first).toBe(addDays(studyDate(at), KNOWN_FIRST_DAY));
    // Every known card is a review card with a long memory and a quick-check log.
    const sample = await cardRow(db, added[0].cardId);
    expect(sample).toMatchObject({ state: "review", introducedOn: studyDate(at) });
    expect(sample.stability).toBeGreaterThan(10);
    const logs = await db.select().from(reviewLogs).where(eq(reviewLogs.source, "quick_check"));
    expect(logs).toHaveLength(900);
  });

  it("puts unsure and forgotten items at the front of the new queue", async () => {
    const unsure = await addCard(db, { newRank: 40 });
    const forgot = await addCard(db, { newRank: 41 });
    const failedSpotCheck = await addCard(db, { newRank: 42 });
    await saveOps(
      db,
      [check(unsure.itemId, "unsure"), check(forgot.itemId, "unknown"), check(failedSpotCheck.itemId, "known", false)],
      at,
    );
    for (const { cardId } of [unsure, forgot, failedSpotCheck]) {
      const card = await cardRow(db, cardId);
      expect(card.state).toBe("new");
      expect(card.newRank).toBeLessThan(0);
    }
    const verdicts = await db.select().from(quickCheck);
    expect(verdicts.map((v) => [v.verdict, v.verified])).toEqual([
      ["unsure", null],
      ["unknown", null],
      ["known", false],
    ]);
  });

  it("records a verified known item once, even when the op is sent twice", async () => {
    const { itemId, cardId } = await addCard(db);
    const op = check(itemId, "known", true);
    expect((await saveOps(db, [op, op], at)).map((r) => r.status)).toEqual(["saved", "duplicate"]);
    expect((await cardRow(db, cardId)).state).toBe("review");
    const logs = await db.select().from(reviewLogs).where(isNull(reviewLogs.voidedAt));
    expect(logs).toHaveLength(1);
  });
});
