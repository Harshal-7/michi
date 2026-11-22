import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/db/client";
import { cards, deckItems, decks, grammarProgress, items, quickCheck } from "@/db/schema";
import { createTestDb } from "@/db/test/test-db";
import { FRONT_OF_QUEUE } from "@/lib/srs/save";

import { loadLesson, loadPoints, markLessonIn } from "./grammar";

let db: Db;
let drop: () => Promise<void>;
beforeAll(async () => ({ db, drop } = await createTestDb()));
afterAll(() => drop?.());

const lesson = (name: string, order: number, confusables: string[] = []) => ({
  gloss: `${name} gloss`,
  formation: `verb て-form + ${name}`,
  topic: order < 2 ? "Requests" : "Rules",
  order,
  links: [{ site: "jlptsensei", url: `https://jlptsensei.com/${name}` }],
  examples: [{ ja: `{書|か}いて[[${name}]]。`, en: "An example." }],
  questions: [],
  confusables,
});

let ids: number[];
beforeEach(async () => {
  await db.execute(sql`truncate decks, items, cards, review_logs, quick_check, grammar_progress, settings restart identity cascade`);
  const [deck] = await db
    .insert(decks)
    .values({ slug: "n5-grammar", name: "N5 grammar", source: "starter", kind: "grammar", level: "N5", active: true, position: 0 })
    .returning();
  // Inserted out of learning order, so the list has to sort them.
  const made = await db
    .insert(items)
    .values(
      (
        [
          ["ないでください", 2, []],
          ["てください", 0, ["grammar:n5:naide-kudasai"]],
          ["てもいい", 1, []],
        ] as const
      ).map(([term, order, conf], i) => ({
        kind: "grammar" as const,
        level: "N5" as const,
        term: `〜${term}`,
        meaning: `${term} meaning.`,
        source: "starter" as const,
        dedupeKey: term,
        seedSlug: ["grammar:n5:naide-kudasai", "grammar:n5:te-kudasai", "grammar:n5:te-mo-ii"][i],
        data: lesson(term, order, [...conf]),
      })),
    )
    .returning();
  await db.insert(deckItems).values(made.map((it, i) => ({ deckId: deck.id, itemId: it.id, position: i })));
  await db.insert(cards).values(made.map((it, i) => ({ itemId: it.id, cardType: "fill_in" as const, newRank: 10 + i })));
  ids = made.map((m) => m.id);
});

const cardOf = async (itemId: number) => (await db.select().from(cards).where(eq(cards.itemId, itemId)))[0];

describe("grammar lessons", () => {
  it("lists points in learning order, grouped by topic, none read yet", async () => {
    const points = await loadPoints(db, "N5");
    expect(points.map((p) => [p.pattern, p.topic, p.status, p.read])).toEqual([
      ["〜てください", "Requests", "not_started", false],
      ["〜てもいい", "Requests", "not_started", false],
      ["〜ないでください", "Rules", "not_started", false],
    ]);
  });

  it("loads a lesson with its look-alikes resolved to their points", async () => {
    const l = await loadLesson(db, ids[1]);
    expect(l).toMatchObject({ pattern: "〜てください", gloss: "てください gloss", topic: "Requests", read: false });
    expect(l!.confusables).toEqual([{ id: ids[0], pattern: "〜ないでください", gloss: "ないでください gloss" }]);
    expect(await loadLesson(db, 999)).toBeNull();
  });

  it("I know this, with the checks right: confident, and the card starts with a long interval", async () => {
    const result = await markLessonIn(db, { opId: randomUUID(), itemId: ids[1], choice: "known", answers: [true, true] });
    // The next lesson in learning order that isn't read.
    expect(result).toEqual({ status: "confident", next: ids[2] });
    const card = await cardOf(ids[1]);
    expect(card.state).toBe("review");
    // Placed like a known quick-check item: on the first day of the 4-week spread with room.
    expect(card.dueAt!.getTime() - Date.now()).toBeGreaterThan(86_400_000);
    expect(card.introducedOn).not.toBeNull();
    expect((await loadPoints(db, "N5"))[0]).toMatchObject({ status: "confident", read: true });
  });

  it("I know this with a check missed counts as Learn it: learning, front of the new queue", async () => {
    const result = await markLessonIn(db, { opId: randomUUID(), itemId: ids[2], choice: "known", answers: [true, false] });
    expect(result).toMatchObject({ status: "learning" });
    const card = await cardOf(ids[2]);
    expect(card.state).toBe("new");
    expect(card.newRank).toBeLessThan(10 - FRONT_OF_QUEUE + 100);
    const [row] = await db.select().from(quickCheck).where(eq(quickCheck.itemId, ids[2]));
    expect(row).toMatchObject({ verdict: "known", verified: false });
  });

  it("Learn it: learning, front of the queue; pressing twice saves it once", async () => {
    const opId = randomUUID();
    await markLessonIn(db, { opId, itemId: ids[0], choice: "learn", answers: [] });
    const again = await markLessonIn(db, { opId, itemId: ids[0], choice: "learn", answers: [] });
    expect(again).toMatchObject({ status: "learning", next: ids[1] });
    expect(await db.select().from(quickCheck)).toHaveLength(1);
    expect(await db.select().from(grammarProgress)).toEqual([expect.objectContaining({ itemId: ids[0], status: "learning" })]);
    expect((await cardOf(ids[0])).newRank).toBeLessThan(0);
  });

  it("refuses an item that isn't a grammar point", async () => {
    const [kana] = await db
      .insert(items)
      .values({ kind: "kana", level: "N5", term: "あ", reading: "a", source: "starter", dedupeKey: "あ" })
      .returning();
    expect(await markLessonIn(db, { opId: randomUUID(), itemId: kana.id, choice: "known", answers: [] })).toHaveProperty("error");
  });
});
