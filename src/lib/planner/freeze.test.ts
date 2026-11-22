import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/db/client";
import { activityLogs, cards, dayPlans, deckItems, decks, items, quickCheck, reviewLogs, taskOverrides } from "@/db/schema";
import { setOverride, updateSettings } from "@/db/settings";
import { createTestDb } from "@/db/test/test-db";
import { addDays, studyDayBounds } from "@/lib/day";

import { readDayPlan } from "./day-plan";
import { evaluate } from "./evaluate";
import { ensureDayPlan, rebuildDayPlan } from "./freeze";
import { loadActivity, loadCountedDays, loadMarks, loadPlanInput, loadQuickCheck } from "./store";

let db: Db;
let drop: () => Promise<void>;
beforeAll(async () => ({ db, drop } = await createTestDb()));
afterAll(() => drop?.());

const DAY = "2026-12-08"; // a Tuesday
const noon = (date: string) => new Date(studyDayBounds(date).start.getTime() + 8 * 3600_000);

/** A starter deck with `n` items, each with one card in state new. */
async function addDeck(slug: string, kind: "kana" | "kanji" | "word" | "grammar", n: number) {
  const [deck] = await db
    .insert(decks)
    .values({ slug, name: slug, source: "starter", kind, level: "N5", active: true, position: 0 })
    .returning();
  const made = await db
    .insert(items)
    .values(Array.from({ length: n }, (_, i) => ({ kind, level: "N5" as const, term: `${slug}${i}`, source: "starter" as const, dedupeKey: `${slug}${i}` })))
    .returning();
  await db.insert(deckItems).values(made.map((it, i) => ({ deckId: deck.id, itemId: it.id, position: i })));
  const madeCards = await db
    .insert(cards)
    .values(made.map((it, i) => ({ itemId: it.id, cardType: kind === "grammar" ? ("fill_in" as const) : ("recognition" as const), newRank: i })))
    .returning();
  return { deck, items: made, cards: madeCards };
}

/** Makes cards review cards due before `date` ends. */
async function makeDue(cardIds: number[], date = DAY) {
  for (const id of cardIds) {
    await db
      .update(cards)
      .set({ state: "review", dueAt: noon(date), lastReviewAt: noon(addDays(date, -3)), introducedOn: addDays(date, -10) })
      .where(eq(cards.id, id));
  }
}

async function grade(cardId: number, date = DAY, source: "session" | "quiz" = "session") {
  await db.insert(reviewLogs).values({ id: randomUUID(), cardId, rating: 3, reviewedAt: noon(date), source, cardBefore: {}, durationMs: 6000 });
}

let kana: Awaited<ReturnType<typeof addDeck>>;
let words: Awaited<ReturnType<typeof addDeck>>;
let grammar: Awaited<ReturnType<typeof addDeck>>;

beforeEach(async () => {
  await db.execute(sql`truncate decks, items, cards, review_logs, quick_check, day_plans, task_overrides,
    activity_logs, settings, calendar_overrides restart identity cascade`);
  kana = await addDeck("hiragana", "kana", 6);
  words = await addDeck("n5-words", "word", 30);
  grammar = await addDeck("n5-grammar", "grammar", 10);
});

describe("freezing the day's plan", () => {
  it("builds the plan on the first load and keeps it for the rest of the day", async () => {
    const first = await ensureDayPlan(db, DAY);
    expect(first.date).toBe(DAY);
    // Reviews fall due later in the day: the frozen plan doesn't change.
    await makeDue(words.cards.slice(0, 5).map((c) => c.id));
    const second = await ensureDayPlan(db, DAY);
    expect(second).toEqual(first);
    expect(await readDayPlan(db, DAY)).toEqual(first);
  });

  it("stores one plan when two devices load at once", async () => {
    const [a, b] = await Promise.all([ensureDayPlan(db, DAY), ensureDayPlan(db, DAY)]);
    expect(a).toEqual(b);
    const rows = await db.select().from(dayPlans);
    expect(rows).toHaveLength(1);
  });

  it("replaces a stored plan that no longer reads as one", async () => {
    await db.insert(dayPlans).values({ studyDate: DAY, plan: { version: 0 } });
    const plan = await ensureDayPlan(db, DAY);
    expect(plan.version).toBe(1);
    expect(await readDayPlan(db, DAY)).toEqual(plan);
  });

  it("plans the quick check first, with no new N5 kana or words until it's done", async () => {
    const plan = await ensureDayPlan(db, DAY);
    expect(plan.tasks.find((t) => t.kind === "quick_check")).toMatchObject({ target: 12 });
    expect(plan.quickCheckTarget).toBe(12);
    expect(Object.keys(plan.newQuota)).toEqual([String(grammar.deck.id)]);
  });

  it("counts the plan's input as of the start of the day", async () => {
    await makeDue(words.cards.slice(0, 4).map((c) => c.id));
    await grade(words.cards[0].id);
    // A card introduced today: still "not started" for today's quota, and not a review.
    await db.update(cards).set({ state: "learning", introducedOn: DAY, dueAt: noon(DAY) }).where(eq(cards.id, grammar.cards[0].id));
    const input = await loadPlanInput(db, DAY);
    expect(input.reviews.due).toBe(4);
    expect(input.decks.find((d) => d.id === grammar.deck.id)!.notStarted).toBe(10);
    expect(input.decks.find((d) => d.id === words.deck.id)!.notStarted).toBe(26);
  });
});

describe("rebuilding", () => {
  it("rebuilds with new settings and keeps finished tasks as they were", async () => {
    await db.insert(quickCheck).values(kana.items.concat(words.items).map((it) => ({ itemId: it.id, verdict: "known" as const })));
    const before = await ensureDayPlan(db, DAY);
    const listening = before.tasks.find((t) => t.kind === "listening")!;
    expect(listening.minutes).toBe(15);
    await db.insert(activityLogs).values({ studyDate: DAY, kind: "listening", skill: "listening", minutes: 15 });
    await db.insert(taskOverrides).values({ studyDate: DAY, taskKey: "speaking", mark: "skipped" });

    await updateSettings(db, { budgets: { weekdayMinutes: 30 } });
    const after = await rebuildDayPlan(db, DAY);
    expect(after.budgetMinutes).toBe(30);
    expect(after.tasks.find((t) => t.kind === "listening")).toEqual(listening);
    expect(after.tasks.find((t) => t.kind === "speaking")).toEqual(before.tasks.find((t) => t.kind === "speaking"));
    const [row] = await db.select().from(dayPlans);
    expect(row.rebuiltAt).not.toBeNull();
  });

  it("keeps today's new-item quota once New items are done", async () => {
    await db.insert(quickCheck).values(kana.items.concat(words.items).map((it) => ({ itemId: it.id, verdict: "unsure" as const })));
    const before = await ensureDayPlan(db, DAY);
    const target = before.tasks.find((t) => t.kind === "new_items")!.target!;
    const quotaCards = [...words.cards, ...grammar.cards, ...kana.cards].filter((c) =>
      Object.keys(before.newQuota).includes(String([words, grammar, kana].find((d) => d.cards.includes(c))!.deck.id)),
    );
    for (const c of quotaCards.slice(0, target)) {
      await db.update(cards).set({ state: "learning", introducedOn: DAY, dueAt: noon(DAY) }).where(eq(cards.id, c.id));
    }
    const status = evaluate(before, await loadActivity(db, before));
    expect(status.tasks.find((t) => t.task.kind === "new_items")!.state).toBe("done");
    await setOverride(db, { date: addDays(DAY, 3), kind: "rest" });
    const after = await rebuildDayPlan(db, DAY);
    expect(after.newQuota).toEqual(before.newQuota);
    expect(after.tasks.find((t) => t.kind === "new_items")).toEqual(before.tasks.find((t) => t.kind === "new_items"));
  });

  it("turns today into a rest day when one is set for it", async () => {
    await ensureDayPlan(db, DAY);
    await setOverride(db, { date: DAY, kind: "rest" });
    const after = await rebuildDayPlan(db, DAY);
    expect(after.mode).toBe("rest");
  });
});

describe("the day's activity", () => {
  it("counts review cards graded in sessions today, not new cards or quiz grades", async () => {
    await makeDue(words.cards.slice(0, 3).map((c) => c.id));
    await grade(words.cards[0].id);
    await grade(words.cards[0].id);
    await grade(words.cards[1].id, DAY, "quiz");
    await db.update(cards).set({ state: "learning", introducedOn: DAY, dueAt: noon(addDays(DAY, 1)) }).where(eq(cards.id, grammar.cards[0].id));
    await grade(grammar.cards[0].id);
    const voided = randomUUID();
    await db.insert(reviewLogs).values({ id: voided, cardId: words.cards[2].id, rating: 1, reviewedAt: noon(DAY), source: "session", cardBefore: {}, voidedAt: new Date() });
    const plan = await ensureDayPlan(db, DAY);
    const a = await loadActivity(db, { ...plan, newQuota: { [grammar.deck.id]: 1 } });
    expect(a.reviewsGraded).toBe(1);
    expect(a.introduced).toBe(1);
    expect(a.reviewsDueNow).toBe(3);
  });

  it("reads the quick check's progress, kana apart", async () => {
    await db.insert(quickCheck).values([
      { itemId: kana.items[0].id, verdict: "known", checkedAt: noon(DAY) },
      { itemId: kana.items[1].id, verdict: "unsure", checkedAt: noon(addDays(DAY, -1)) },
      { itemId: words.items[0].id, verdict: "unknown", checkedAt: noon(DAY) },
    ]);
    expect(await loadQuickCheck(db, DAY)).toEqual({
      leftKana: 4,
      leftOther: 29,
      todayKana: 1,
      todayOther: 1,
      startedOn: addDays(DAY, -1),
    });
  });

  it("works out the streak's days from each day's frozen plan", async () => {
    const days = [addDays(DAY, -3), addDays(DAY, -2), addDays(DAY, -1)];
    await makeDue(words.cards.slice(0, 2).map((c) => c.id), days[0]);
    for (const d of days) await ensureDayPlan(db, d);
    // Day 1: both due cards graded. Day 2: nothing. Day 3: marked done by hand.
    await grade(words.cards[0].id, days[0]);
    await grade(words.cards[1].id, days[0]);
    await db.insert(taskOverrides).values({ studyDate: days[2], taskKey: "reviews", mark: "done" });
    const { counted, first } = await loadCountedDays(db, DAY);
    expect(first).toBe(days[0]);
    expect([...counted].sort()).toEqual([days[0], days[2]]);
    expect(await loadMarks(db, days[2])).toEqual({ reviews: "done" });
  });
});
