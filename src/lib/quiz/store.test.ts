import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/db/client";
import { assessments, cards, items, questions, quickCheck, reviewLogs } from "@/db/schema";
import { createTestDb } from "@/db/test/test-db";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";
import { cardRow, resetStudyTables } from "@/lib/srs/test-helpers";

import { seeded } from "./random";
import { answerQuestion, findQuiz, loadHistory, loadMistakes, openTestWeek, type Quiz, retryMistake, startQuiz, submitQuiz } from "./store";

let db: Db;
let drop: () => Promise<void>;
beforeAll(async () => ({ db, drop } = await createTestDb()));
afterAll(() => drop?.());
beforeEach(async () => {
  await resetStudyTables(db);
  await db.execute(sql`truncate assessments, questions, mistake_clears, user_sentences, grammar_progress restart identity cascade`);
});

const date = "2026-12-03";
const settings = DEFAULT_SETTINGS;
const HIRAGANA = [
  ["あ", "a"], ["い", "i"], ["う", "u"], ["え", "e"], ["お", "o"],
  ["か", "ka"], ["き", "ki"], ["く", "ku"], ["け", "ke"], ["こ", "ko"],
  ["さ", "sa"], ["し", "shi"], ["す", "su"], ["せ", "se"], ["そ", "so"],
] as const;

async function addKana() {
  const rows = await db
    .insert(items)
    .values(HIRAGANA.map(([kana, romaji]) => ({ kind: "kana" as const, level: "N5" as const, term: kana, reading: romaji, source: "starter" as const, dedupeKey: `kana-${kana}`, data: { script: "hiragana" as const, group: "basic" as const, accept: [], lookalikes: [] } })))
    .returning({ id: items.id });
  const added = await db.insert(cards).values(rows.map((r) => ({ itemId: r.id, cardType: "recognition" as const }))).returning({ id: cards.id, itemId: cards.itemId });
  return added;
}

/** Answers every question, the first one wrong. */
async function answerAll(quiz: Quiz, wrongFirst = true) {
  for (const [i, q] of quiz.questions.entries()) {
    const choice = wrongFirst && i === 0 ? (q.asked.answer + 1) % 4 : q.asked.answer;
    await answerQuestion(db, { questionId: q.id, choice, now: new Date("2026-12-03T05:00:00Z") });
  }
}

describe("quizzes", () => {
  it("starts one daily quiz per day, frozen as asked, filling in with kana", async () => {
    await addKana();
    const quiz = await startQuiz(db, { kind: "daily", date, settings, hasVoice: true, random: seeded(1) });
    if ("error" in quiz) throw new Error(quiz.error);
    expect(quiz.questions).toHaveLength(10);
    expect(quiz.questions.every((q) => q.asked.type === "kana")).toBe(true);
    const again = await startQuiz(db, { kind: "daily", date, settings, hasVoice: true, random: seeded(2) });
    expect("id" in again && again.id).toBe(quiz.id);
    expect(await db.$count(assessments)).toBe(1);
  });

  it("counts a wrong answer as a miss once, leaves right answers alone, and submits", async () => {
    const kana = await addKana();
    // One kana is a review card already.
    await db.update(cards).set({ state: "review", dueAt: new Date("2026-12-20T00:00:00Z"), lastReviewAt: new Date("2026-11-30T00:00:00Z"), stability: 20, reps: 3 }).where(eq(cards.id, kana[0].id));
    const quiz = (await startQuiz(db, { kind: "daily", date, settings, hasVoice: true, random: seeded(3) })) as Quiz;
    const first = quiz.questions[0];
    const result = await answerQuestion(db, { questionId: first.id, choice: (first.asked.answer + 1) % 4 });
    expect(result).toMatchObject({ correct: false, answer: first.asked.answer });
    // Answering again changes nothing.
    expect(await answerQuestion(db, { questionId: first.id, choice: first.asked.answer })).toMatchObject({ correct: false });
    const card = await db.select().from(cards).where(eq(cards.itemId, first.itemId!));
    if (card[0].state === "new") expect(card[0].newRank).toBeLessThan(0);
    else expect(await db.$count(reviewLogs, and(eq(reviewLogs.cardId, card[0].id), eq(reviewLogs.source, "quiz")))).toBe(1);

    expect(await submitQuiz(db, quiz.id)).toEqual({ error: "9 questions still to answer." });
    for (const q of quiz.questions.slice(1)) await answerQuestion(db, { questionId: q.id, choice: q.asked.answer });
    expect(await submitQuiz(db, quiz.id)).toEqual({ ok: true });
    const done = await findQuiz(db, "daily", date);
    expect(done).toMatchObject({ status: "submitted", score: 9, total: 10 });
    // Right answers left their cards alone.
    const untouched = await cardRow(db, kana[5].id);
    expect(untouched.state === "new" && untouched.newRank >= 0).toBe(true);
    expect(await loadHistory(db)).toMatchObject([{ id: quiz.id, kind: "daily", score: 9, total: 10 }]);
  });

  it("puts a missed review card through Again with source quiz", async () => {
    const kana = await addKana();
    for (const k of kana) {
      await db.update(cards).set({ state: "review", dueAt: new Date("2026-12-20T00:00:00Z"), lastReviewAt: new Date("2026-11-30T00:00:00Z"), stability: 20, difficulty: 5, reps: 3, fsrs: null }).where(eq(cards.id, k.id));
    }
    const quiz = (await startQuiz(db, { kind: "daily", date, settings, hasVoice: true, random: seeded(4) })) as Quiz;
    await answerAll(quiz);
    const missed = quiz.questions[0].itemId!;
    const [card] = await db.select().from(cards).where(eq(cards.itemId, missed));
    const logs = await db.select().from(reviewLogs).where(eq(reviewLogs.cardId, card.id));
    expect(logs).toMatchObject([{ rating: 1, source: "quiz" }]);
    expect(["learning", "relearning"]).toContain(card.state);
  });

  it("asks only about started or known items, plus kana", async () => {
    await addKana();
    const [known] = await db.insert(items).values({ kind: "kanji", level: "N5", term: "日", reading: "ニチ", meaning: "day, sun", source: "starter", dedupeKey: "日", data: { meanings: ["day", "sun"], on: ["ニチ"], kun: ["ひ"], lookalikes: [], strokes: 4, examples: [] } }).returning({ id: items.id });
    const [unseen] = await db.insert(items).values({ kind: "kanji", level: "N5", term: "月", reading: "ゲツ", meaning: "month, moon", source: "starter", dedupeKey: "月", data: { meanings: ["month", "moon"], on: ["ゲツ"], kun: ["つき"], lookalikes: [], strokes: 4, examples: [] } }).returning({ id: items.id });
    await db.insert(quickCheck).values({ itemId: known.id, verdict: "known" });
    const quiz = (await startQuiz(db, { kind: "daily", date, settings, hasVoice: true, random: seeded(5) })) as Quiz;
    const asked = new Set(quiz.questions.map((q) => q.itemId));
    expect(asked.has(unseen.id)).toBe(false);
  });

  it("keeps mistakes waiting until answered right in the review", async () => {
    await addKana();
    const quiz = (await startQuiz(db, { kind: "daily", date, settings, hasVoice: true, random: seeded(6) })) as Quiz;
    await answerAll(quiz);
    const waiting = await loadMistakes(db, date);
    expect(waiting.map((m) => m.id)).toEqual([quiz.questions[0].id]);
    const m = waiting[0];
    expect(await retryMistake(db, m.id, (m.asked.answer + 1) % 4)).toMatchObject({ correct: false });
    expect(await loadMistakes(db, date)).toHaveLength(1);
    expect(await retryMistake(db, m.id, m.asked.answer)).toMatchObject({ correct: true });
    expect(await loadMistakes(db, date)).toHaveLength(0);
    // A week later they've gone anyway.
    expect(await db.$count(questions)).toBe(10);
  });

  it("opens the weekly test on Sunday and keeps it open to Wednesday", async () => {
    expect(openTestWeek("2026-12-06")).toBe("2026-11-30"); // Sunday
    expect(openTestWeek("2026-12-09")).toBe("2026-11-30"); // Wednesday
    expect(openTestWeek("2026-12-10")).toBeNull(); // Thursday
    expect(openTestWeek("2026-12-05")).toBeNull(); // Saturday
    await addKana();
    expect(await startQuiz(db, { kind: "weekly", date: "2026-12-05", settings, hasVoice: true })).toEqual({ error: "The weekly test opens on Sunday." });
    const test = (await startQuiz(db, { kind: "weekly", date: "2026-12-08", settings, hasVoice: true, random: seeded(7) })) as Quiz;
    expect(test.weekStart).toBe("2026-11-30");
    expect(test.questions.length).toBeGreaterThanOrEqual(15);
  });
});
