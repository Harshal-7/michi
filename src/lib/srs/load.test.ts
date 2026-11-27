import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/db/client";
import { cards, itemContexts, items, userSentences } from "@/db/schema";
import { createTestDb } from "@/db/test/test-db";
import { studyDayBounds } from "@/lib/day";
import type { DayPlan } from "@/lib/planner/day-plan";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";

import { loadNewCards, loadReviewQueue } from "./load";
import { saveOps } from "./save";
import { addCard, addDeck, resetStudyTables } from "./test-helpers";

let db: Db;
let drop: () => Promise<void>;
beforeAll(async () => ({ db, drop } = await createTestDb()));
afterAll(() => drop?.());
beforeEach(() => resetStudyTables(db));

// Thu 3 Dec 2026, 10:30 IST.
const now = new Date("2026-12-03T05:00:00.000Z");
const settings = DEFAULT_SETTINGS;

async function due(cardId: number, state: "learning" | "relearning" | "review", dueAt: Date) {
  await db.update(cards).set({ state, dueAt }).where(eq(cards.id, cardId));
}

describe("loadReviewQueue", () => {
  it("loads learning cards due within 20 minutes and reviews due before the next 4 am", async () => {
    const deck = await addDeck(db);
    const soon = await addCard(db, { deckId: deck });
    const tooLate = await addCard(db, { deckId: deck });
    const tonight = await addCard(db, { deckId: deck });
    const tomorrow = await addCard(db, { deckId: deck });
    const fresh = await addCard(db, { deckId: deck });
    await due(soon.cardId, "learning", new Date(now.getTime() + 15 * 60_000));
    await due(tooLate.cardId, "relearning", new Date(now.getTime() + 25 * 60_000));
    const { end } = studyDayBounds("2026-12-03");
    await due(tonight.cardId, "review", new Date(end.getTime() - 60_000));
    await due(tomorrow.cardId, "review", end);

    const { cards: queue, backlog } = await loadReviewQueue(db, { settings, now });
    expect(queue.map((c) => c.id)).toEqual([soon.cardId, tonight.cardId]);
    expect(backlog).toBe(false);
    expect(queue.some((c) => c.id === fresh.cardId)).toBe(false);
  });

  it("orders learning, then class and current-level cards, then the rest", async () => {
    const n4 = await addCard(db, { level: "N4" });
    const n5 = await addCard(db, { level: "N5" });
    const fromClass = await addCard(db, { level: "N4", source: "class" });
    const learning = await addCard(db, { level: "N4" });
    const yesterday = new Date(now.getTime() - 86_400_000);
    await due(n4.cardId, "review", new Date(yesterday.getTime() - 60_000));
    await due(n5.cardId, "review", yesterday);
    await due(fromClass.cardId, "review", now);
    await due(learning.cardId, "learning", now);
    // 21 Nov to 31 Dec is the N5 phase in the default settings.
    const { cards: queue } = await loadReviewQueue(db, { settings, now });
    expect(queue.map((c) => c.id)).toEqual([learning.cardId, n5.cardId, fromClass.cardId, n4.cardId]);
  });

  it("limits the queue to one deck and carries the item's content", async () => {
    const words = await addDeck(db, "N5 words");
    const kanji = await addDeck(db, "N5 kanji", 1);
    const word = await addCard(db, { deckId: words });
    const char = await addCard(db, { deckId: kanji, kind: "kanji" });
    await due(word.cardId, "review", now);
    await due(char.cardId, "review", now);
    await db.insert(itemContexts).values({ itemId: word.itemId, ja: "{教室|きょうしつ}で", en: "in class" });

    const { cards: queue } = await loadReviewQueue(db, { settings, now, deckId: words });
    expect(queue).toHaveLength(1);
    expect(queue[0].item).toMatchObject({ id: word.itemId, kind: "word", context: { ja: "{教室|きょうしつ}で", en: "in class" } });
  });
  it("puts a grammar point's checked sentences after its examples, never the unchecked ones", async () => {
    const point = await addCard(db, { kind: "grammar", cardType: "fill_in" });
    const word = await addCard(db);
    await db
      .update(items)
      .set({ data: { examples: [{ ja: "{書|か}い[[てください]]。", en: "Please write." }] } as never })
      .where(eq(items.id, point.itemId));
    await db.insert(userSentences).values([
      { itemId: point.itemId, ja: "ゆっくり{話|はな}し[[てください]]。", en: "Please speak slowly.", checked: true },
      { itemId: point.itemId, ja: "まどをあけ[[てください]]。", en: "", checked: false },
      { itemId: word.itemId, ja: "[[語]]です。", en: "", checked: true },
    ]);
    await due(point.cardId, "review", now);
    await due(word.cardId, "review", now);

    const { cards: queue } = await loadReviewQueue(db, { settings, now });
    const grammar = queue.find((c) => c.id === point.cardId);
    expect(grammar?.item.data.examples).toEqual([
      { ja: "{書|か}い[[てください]]。", en: "Please write." },
      { ja: "ゆっくり{話|はな}し[[てください]]。", en: "Please speak slowly." },
    ]);
    // Only grammar points take sentences in as examples.
    expect(queue.find((c) => c.id === word.cardId)?.item.data.examples).toBeUndefined();
  });
});

describe("loadNewCards", () => {
  const plan = (newQuota: Record<string, number>): DayPlan => ({
    version: 1,
    date: "2026-12-03",
    mode: "normal",
    budgetMinutes: 75,
    tasks: [],
    newQuota,
    quickCheckTarget: 0,
  });

  it("introduces exactly the plan's quota per deck, in rank order with class items first", async () => {
    const kanji = await addDeck(db, "N5 kanji", 0);
    const words = await addDeck(db, "N5 words", 1);
    const k = [];
    for (let i = 0; i < 4; i++) k.push(await addCard(db, { deckId: kanji, kind: "kanji", newRank: 10 - i }));
    const w = [];
    for (let i = 0; i < 3; i++) w.push(await addCard(db, { deckId: words, newRank: i }));
    const classWord = await addCard(db, { deckId: words, source: "class", newRank: 99 });

    const { cards: picked, decks } = await loadNewCards(db, {
      plan: plan({ [kanji]: 2, [words]: 2 }),
      date: "2026-12-03",
    });
    expect(picked.map((c) => c.id)).toEqual([k[3].cardId, k[2].cardId, classWord.cardId, w[0].cardId]);
    expect(decks.map((d) => [d.name, d.quota, d.introduced])).toEqual([
      ["N5 kanji", 2, 0],
      ["N5 words", 2, 0],
    ]);
  });

  it("counts cards already introduced today against the quota", async () => {
    const words = await addDeck(db);
    const a = await addCard(db, { deckId: words, newRank: 0 });
    const b = await addCard(db, { deckId: words, newRank: 1 });
    await addCard(db, { deckId: words, newRank: 2 });
    await saveOps(
      db,
      [
        {
          kind: "grade",
          id: crypto.randomUUID(),
          cardId: a.cardId,
          rating: 3,
          reviewedAt: now.toISOString(),
          durationMs: null,
          lastReviewId: null,
        },
      ],
      now,
    );
    const { cards: picked, decks } = await loadNewCards(db, { plan: plan({ [words]: 2 }), date: "2026-12-03" });
    expect(picked.map((c) => c.id)).toEqual([b.cardId]);
    expect(decks[0].introduced).toBe(1);
  });

  it("introduces nothing for a deck the plan gives no quota", async () => {
    const words = await addDeck(db);
    await addCard(db, { deckId: words });
    expect((await loadNewCards(db, { plan: plan({}), date: "2026-12-03" })).cards).toEqual([]);
  });
});
