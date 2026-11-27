/**
 * Quizzes in the database: the pool and bank they're built from, starting one, answering,
 * submitting, the mistakes review and the history. Uses `assessments` and `questions`; each
 * question is saved exactly as it was asked (types.ts).
 *
 * - One daily quiz per study date; one weekly test per week, open from its Sunday to Wednesday.
 * - A wrong answer counts as Again on the item's cards, at most once per card per day, or moves an
 *   item not started yet to the front of the new queue (recordQuizMiss). Right answers change nothing.
 */
import { blanks } from "@content/schema";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import type { Db, DbOrTx } from "@/db/client";
import { assessments, items, mistakeClears, questions } from "@/db/schema";
import { addDays, phaseFor, type StudyDate, studyDayBounds, weekday, weekOf } from "@/lib/day";
import type { Settings } from "@/lib/settings/schema";
import { recordQuizMiss } from "@/lib/srs/save";

import { type ItemRow, toGrammar, toKana, toKanji, toWord } from "./bank";
import type { Bank, QGrammar, QKana, QKanji, QWord, Sentence } from "./builders";
import { compose, type Pool, type Weighted } from "./compose";
import { type Random } from "./random";
import { Asked, type QuizKind } from "./types";

type Row = Record<string, unknown>;
const rows = async <T extends Row>(db: DbOrTx, query: ReturnType<typeof sql>) => (await db.execute<T>(query)).rows as T[];

/** Nothing answered right within this many days comes up again. */
export const RIGHT_REST_DAYS = 7;
/** Misses within this many days make an item come up more. */
const MISSED_DAYS = 14;
/** Mistakes wait in the review for this many days. */
export const MISTAKE_DAYS = 7;
/** The weekly test stays open this many days after its Sunday (to Wednesday). */
export const WEEKLY_OPEN_DAYS = 3;

// ---------------------------------------------------------------------------
// Which levels, which week

export function levelsFor(date: StudyDate, settings: Settings): ("N5" | "N4" | "N3")[] {
  const phase = phaseFor(date, settings)?.id ?? "n5";
  if (phase === "n5") return ["N5"];
  if (phase === "n4") return ["N5", "N4"];
  return ["N5", "N4", "N3"];
}

/** Kana get their own question in Phase 1 (decision 14). */
export const isKanaPhase = (date: StudyDate, settings: Settings) => (phaseFor(date, settings)?.id ?? "n5") === "n5";

/** The week (its Monday) whose test is open on `date`: Sunday to Wednesday. Null on other days. */
export function openTestWeek(date: StudyDate): StudyDate | null {
  const day = weekday(date);
  if (day === 0) return weekOf(date).start;
  if (day >= 1 && day <= WEEKLY_OPEN_DAYS) return weekOf(addDays(date, -7)).start;
  return null;
}

/** The Sunday a week's test opens. */
export const testSunday = (weekStart: StudyDate) => addDays(weekStart, 6);

// ---------------------------------------------------------------------------
// The bank and the pool

/** Everything the wrong options come from: the content at the levels studied so far. */
export async function loadBank(db: DbOrTx, levels: readonly string[]): Promise<{ bank: Bank; byId: Map<number, QWord | QKanji | QKana | QGrammar> }> {
  const found = (await db
    .select({ id: items.id, kind: items.kind, level: items.level, term: items.term, reading: items.reading, meaning: items.meaning, data: items.data, seedSlug: items.seedSlug })
    .from(items)
    .where(and(inArray(items.kind, ["kana", "kanji", "word", "grammar"]), sql`(${items.level} is null or ${items.level} in (${sql.join(levels.map((l) => sql`${l}`), sql`, `)}) or ${items.kind} = 'kana')`))
    .orderBy(asc(items.id))) as (ItemRow & { seedSlug: string | null })[];
  const sentences = await checkedSentences(db);
  const words: QWord[] = [];
  const kanji: QKanji[] = [];
  const kana: QKana[] = [];
  const grammar: QGrammar[] = [];
  const titleBySlug = new Map<string, string>();
  const confusableSlugs = new Map<number, string[]>();
  for (const r of found) {
    const w = toWord(r);
    if (w) words.push(w);
    const k = toKanji(r);
    if (k) kanji.push(k);
    const kn = toKana(r);
    if (kn) kana.push(kn);
    const g = toGrammar(r, sentences.get(r.id) ?? []);
    if (g) {
      grammar.push(g);
      if (r.seedSlug) titleBySlug.set(r.seedSlug, g.pattern);
      const d = (r.data ?? {}) as { confusables?: unknown };
      if (Array.isArray(d.confusables)) confusableSlugs.set(g.id, d.confusables.filter((s): s is string => typeof s === "string"));
    }
  }
  for (const g of grammar) g.confusables = (confusableSlugs.get(g.id) ?? []).map((s) => titleBySlug.get(s)).filter((t): t is string => !!t);
  const byId = new Map<number, QWord | QKanji | QKana | QGrammar>();
  for (const x of [...words, ...kanji, ...kana, ...grammar]) byId.set(x.id, x);
  return { bank: { words, kanji, kana, grammar }, byId };
}

/** Your checked sentences with a single [[blank]], by grammar point. Unchecked ones never come here. */
async function checkedSentences(db: DbOrTx): Promise<Map<number, Sentence[]>> {
  const found = await rows<{ item_id: number; ja: string; en: string }>(db, sql`select item_id, ja, en from user_sentences where checked order by id`);
  const out = new Map<number, Sentence[]>();
  for (const s of found) {
    if (blanks(s.ja).length !== 1) continue;
    out.set(s.item_id, [...(out.get(s.item_id) ?? []), { ja: s.ja, en: s.en }]);
  }
  return out;
}

type PoolRow = {
  item_id: number;
  kind: string;
  source: string;
  started: boolean;
  weak: boolean;
  missed: boolean;
  this_week: boolean;
};

/**
 * The items a quiz may ask about (decision 2): started or marked known, plus grammar points read
 * in the read-through; never one answered right in the last 7 days. Weaker items (learning, or
 * forgotten before), recent misses and class items weigh more. A weekly test weighs the week's
 * items (started, missed, from class, grammar worked on) far above the rest.
 */
export async function loadPool(
  db: DbOrTx,
  options: { date: StudyDate; byId: Map<number, QWord | QKanji | QKana | QGrammar>; week?: StudyDate | null },
): Promise<Pool> {
  const { start } = studyDayBounds(options.date);
  const restFrom = studyDayBounds(addDays(options.date, -RIGHT_REST_DAYS + 1)).start;
  const missedFrom = studyDayBounds(addDays(options.date, -MISSED_DAYS)).start;
  const week = options.week ?? null;
  const weekFrom = week ? studyDayBounds(week).start : start;
  const weekTo = week ? studyDayBounds(addDays(week, 6)).end : start;
  const found = await rows<PoolRow>(
    db,
    sql`with card_state as (
        select c.item_id,
          bool_or(c.state <> 'new') as started,
          bool_or(c.state in ('learning', 'relearning') or c.lapses > 0) as weak,
          bool_or(c.introduced_on between ${week ?? options.date}::date and ${week ? addDays(week, 6) : options.date}::date) as introduced_in_week
        from cards c where c.status = 'active' group by c.item_id
      ),
      answered as (
        select q.item_id,
          bool_or(q.correct and q.answered_at >= ${restFrom}) as right_recently,
          bool_or(not q.correct and q.answered_at >= ${missedFrom}) as missed,
          bool_or(not q.correct and q.answered_at >= ${weekFrom} and q.answered_at < ${weekTo}) as missed_in_week
        from questions q where q.item_id is not null and q.answered_at is not null group by q.item_id
      ),
      week_misses as (
        select distinct c.item_id from review_logs rl join cards c on c.id = rl.card_id
        where rl.rating = 1 and rl.voided_at is null and rl.reviewed_at >= ${weekFrom} and rl.reviewed_at < ${weekTo}
      )
      select i.id as item_id, i.kind::text as kind, i.source::text as source,
        (coalesce(s.started, false) or qc.verdict = 'known') as started,
        coalesce(s.weak, false) as weak,
        coalesce(a.missed, false) as missed,
        (coalesce(s.introduced_in_week, false) or coalesce(a.missed_in_week, false) or wm.item_id is not null
          or (i.source = 'class' and i.created_at >= ${weekFrom} and i.created_at < ${weekTo})
          or (i.kind = 'grammar' and (gp.updated_at >= ${weekFrom} and gp.updated_at < ${weekTo}
              or qc.checked_at >= ${weekFrom} and qc.checked_at < ${weekTo}))) as this_week
      from items i
      left join card_state s on s.item_id = i.id
      left join quick_check qc on qc.item_id = i.id
      left join grammar_progress gp on gp.item_id = i.id
      left join answered a on a.item_id = i.id
      left join week_misses wm on wm.item_id = i.id
      where i.kind in ('kana', 'kanji', 'word', 'grammar')
        and not coalesce(a.right_recently, false)
        and (coalesce(s.started, false) or qc.verdict = 'known' or (i.kind = 'grammar' and qc.item_id is not null) or i.kind = 'kana')`,
  );
  const pool: Pool = { words: [], kanji: [], grammar: [], kana: [] };
  for (const r of found) {
    const item = options.byId.get(r.item_id);
    if (!item) continue;
    // Kana not started yet only fill in; the ones you know come up first.
    let weight = r.kind === "kana" && !r.started ? 0.2 : 1;
    if (r.weak) weight *= 2;
    if (r.missed) weight *= 3;
    if (r.source === "class") weight *= 2;
    if (week) weight *= r.this_week ? 20 : 1;
    const add = <T>(list: Weighted<T>[]) => list.push({ item: item as T, weight });
    if (r.kind === "word") add(pool.words);
    else if (r.kind === "kanji") add(pool.kanji);
    else if (r.kind === "grammar") add(pool.grammar);
    else add(pool.kana);
  }
  return pool;
}

// ---------------------------------------------------------------------------
// Assessments

export type QuizQuestion = {
  id: number;
  position: number;
  itemId: number | null;
  asked: Asked;
  /** The option chosen, as shown; null until answered. */
  answer: string | null;
  correct: boolean | null;
};

export type Quiz = {
  id: number;
  kind: QuizKind;
  status: "open" | "submitted";
  studyDate: StudyDate;
  weekStart: StudyDate | null;
  startedAt: Date;
  submittedAt: Date | null;
  score: number | null;
  total: number;
  questions: QuizQuestion[];
};

async function loadQuestions(db: DbOrTx, assessmentId: number): Promise<QuizQuestion[]> {
  const found = await db.select().from(questions).where(eq(questions.assessmentId, assessmentId)).orderBy(asc(questions.position));
  return found.flatMap((q) => {
    const asked = Asked.safeParse(q.asked);
    return asked.success ? [{ id: q.id, position: q.position, itemId: q.itemId, asked: asked.data, answer: q.answer, correct: q.correct }] : [];
  });
}

export async function loadQuiz(db: DbOrTx, id: number): Promise<Quiz | null> {
  const [a] = await db.select().from(assessments).where(eq(assessments.id, id));
  if (!a || (a.kind !== "daily" && a.kind !== "weekly")) return null;
  return {
    id: a.id,
    kind: a.kind,
    status: a.status,
    studyDate: a.studyDate,
    weekStart: a.weekStart,
    startedAt: a.startedAt,
    submittedAt: a.submittedAt,
    score: a.score,
    total: a.total ?? 0,
    questions: await loadQuestions(db, a.id),
  };
}

/** Today's daily quiz, or the given week's test, if it has been started. */
export async function findQuiz(db: DbOrTx, kind: QuizKind, key: StudyDate): Promise<Quiz | null> {
  const [a] = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(kind === "daily" ? and(eq(assessments.kind, "daily"), eq(assessments.studyDate, key)) : and(eq(assessments.kind, "weekly"), eq(assessments.weekStart, key)));
  return a ? loadQuiz(db, a.id) : null;
}

/**
 * Starts today's daily quiz or the open week's test, or returns the one already started (two
 * devices starting at once get the same one). `hasVoice`: listening questions become meaning
 * questions on a device with no Japanese voice.
 */
export async function startQuiz(
  db: Db,
  options: { kind: QuizKind; date: StudyDate; settings: Settings; hasVoice: boolean; random?: Random },
): Promise<Quiz | { error: string }> {
  const { kind, date, settings } = options;
  const week = kind === "weekly" ? openTestWeek(date) : null;
  if (kind === "weekly" && !week) return { error: "The weekly test opens on Sunday." };
  const key = week ?? date;
  const existing = await findQuiz(db, kind, key);
  if (existing) return existing;

  const { bank, byId } = await loadBank(db, levelsFor(date, settings));
  const pool = await loadPool(db, { date, byId, week });
  const built = compose({ kind, pool, bank, kanaPhase: isKanaPhase(date, settings), hasVoice: options.hasVoice, random: options.random ?? Math.random });
  if (built.length === 0) return { error: "There's nothing to ask about yet. Start some cards first." };

  const id = await db.transaction(async (tx) => {
    const [a] = await tx
      .insert(assessments)
      .values({ kind, studyDate: date, weekStart: week, total: built.length, level: levelsFor(date, settings).at(-1) })
      .onConflictDoNothing()
      .returning({ id: assessments.id });
    if (!a) return null;
    await tx.insert(questions).values(built.map((b, position) => ({ assessmentId: a.id, position, type: b.asked.type, itemId: b.itemId, asked: b.asked })));
    return a.id;
  });
  const quiz = id === null ? await findQuiz(db, kind, key) : await loadQuiz(db, id);
  return quiz ?? { error: "That didn't start. Try again." };
}

export type AnswerResult = { correct: boolean; answer: number } | { error: string };

/**
 * Saves an answer once (answering again changes nothing). A wrong one counts as Again on the
 * item's cards, or puts an item not started yet first in the new queue.
 */
export async function answerQuestion(db: Db, input: { questionId: number; choice: number; now?: Date }): Promise<AnswerResult> {
  const now = input.now ?? new Date();
  const [q] = await db
    .select({ id: questions.id, asked: questions.asked, answer: questions.answer, correct: questions.correct, itemId: questions.itemId, status: assessments.status })
    .from(questions)
    .innerJoin(assessments, eq(assessments.id, questions.assessmentId))
    .where(eq(questions.id, input.questionId));
  const asked = q ? Asked.safeParse(q.asked) : null;
  if (!q || !asked?.success) return { error: "That question isn't there any more." };
  if (q.correct !== null) return { correct: q.correct, answer: asked.data.answer };
  if (q.status !== "open") return { error: "This quiz is already finished." };
  if (!Number.isInteger(input.choice) || input.choice < 0 || input.choice > 3) return { error: "Pick one of the four." };
  const correct = input.choice === asked.data.answer;
  const [saved] = await db
    .update(questions)
    .set({ answer: asked.data.options[input.choice], correct, answeredAt: now })
    .where(and(eq(questions.id, q.id), sql`${questions.correct} is null`))
    .returning({ id: questions.id });
  if (saved && !correct && q.itemId !== null) await recordQuizMiss(db, q.itemId, now);
  return { correct, answer: asked.data.answer };
}

/** Finishes a quiz once every question is answered. */
export async function submitQuiz(db: Db, assessmentId: number, now = new Date()): Promise<{ ok: true } | { error: string }> {
  const quiz = await loadQuiz(db, assessmentId);
  if (!quiz) return { error: "That quiz isn't there any more." };
  if (quiz.status === "submitted") return { ok: true };
  const left = quiz.questions.filter((q) => q.correct === null).length;
  if (left > 0) return { error: `${left} question${left === 1 ? "" : "s"} still to answer.` };
  const score = quiz.questions.filter((q) => q.correct).length;
  await db
    .update(assessments)
    .set({ status: "submitted", submittedAt: now, score, total: quiz.questions.length })
    .where(and(eq(assessments.id, assessmentId), eq(assessments.status, "open")));
  return { ok: true };
}

/**
 * What each missed item's miss did: back into reviews (an Again graded by the quiz), or to the
 * front of the new cards (not started yet). Counts items, for the results' one line.
 */
export async function missOutcomes(db: DbOrTx, quiz: Quiz): Promise<{ reviews: number; newCards: number }> {
  const missed = [...new Set(quiz.questions.filter((q) => q.correct === false && q.itemId !== null).map((q) => q.itemId!))];
  if (missed.length === 0) return { reviews: 0, newCards: 0 };
  const graded = await rows<{ item_id: number }>(
    db,
    sql`select distinct c.item_id from review_logs rl join cards c on c.id = rl.card_id
      where rl.source = 'quiz' and rl.voided_at is null and c.item_id in (${sql.join(missed.map((id) => sql`${id}`), sql`, `)})
        and rl.reviewed_at >= ${quiz.startedAt}`,
  );
  const reviews = graded.length;
  return { reviews, newCards: missed.length - reviews };
}

// ---------------------------------------------------------------------------
// Mistakes and history

export type Mistake = QuizQuestion & { answeredAt: Date };

/**
 * Wrong answers from the last 7 days not yet answered right again in the mistakes review, one per
 * item (the latest), oldest first.
 */
export async function loadMistakes(db: DbOrTx, date: StudyDate): Promise<Mistake[]> {
  const from = studyDayBounds(addDays(date, -MISTAKE_DAYS + 1)).start;
  const found = await db
    .select({ id: questions.id, position: questions.position, itemId: questions.itemId, asked: questions.asked, answer: questions.answer, correct: questions.correct, answeredAt: questions.answeredAt })
    .from(questions)
    .leftJoin(mistakeClears, eq(mistakeClears.questionId, questions.id))
    .where(and(eq(questions.correct, false), isNotNull(questions.answeredAt), sql`${questions.answeredAt} >= ${from}`, sql`${mistakeClears.questionId} is null`))
    .orderBy(desc(questions.answeredAt));
  const seen = new Set<string>();
  const out: Mistake[] = [];
  for (const q of found) {
    const asked = Asked.safeParse(q.asked);
    const key = q.itemId === null ? `q${q.id}` : `i${q.itemId}`;
    if (!asked.success || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...q, asked: asked.data, answeredAt: q.answeredAt! });
  }
  return out.reverse();
}

/** The mistakes review: a right answer clears the mistake (and any older one about the same item). */
export async function retryMistake(db: Db, questionId: number, choice: number): Promise<AnswerResult> {
  const [q] = await db.select({ asked: questions.asked, itemId: questions.itemId, correct: questions.correct }).from(questions).where(eq(questions.id, questionId));
  const asked = q ? Asked.safeParse(q.asked) : null;
  if (!q || !asked?.success || q.correct !== false) return { error: "That mistake isn't there any more." };
  const correct = choice === asked.data.answer;
  if (correct) {
    const same = q.itemId === null ? [{ id: questionId }] : await db.select({ id: questions.id }).from(questions).where(and(eq(questions.itemId, q.itemId), eq(questions.correct, false)));
    await db.insert(mistakeClears).values(same.map((s) => ({ questionId: s.id }))).onConflictDoNothing();
  }
  return { correct, answer: asked.data.answer };
}

export type HistoryRow = { id: number; kind: QuizKind; studyDate: StudyDate; weekStart: StudyDate | null; score: number; total: number };

/** Finished quizzes and tests, newest first. */
export async function loadHistory(db: DbOrTx, limit = 60): Promise<HistoryRow[]> {
  const found = await db
    .select({ id: assessments.id, kind: assessments.kind, studyDate: assessments.studyDate, weekStart: assessments.weekStart, score: assessments.score, total: assessments.total })
    .from(assessments)
    .where(and(inArray(assessments.kind, ["daily", "weekly"]), eq(assessments.status, "submitted")))
    .orderBy(desc(assessments.studyDate), desc(assessments.id))
    .limit(limit);
  return found.map((a) => ({ ...a, kind: a.kind as QuizKind, score: a.score ?? 0, total: a.total ?? 0 }));
}

/** Right and asked by question type over the last `days` days, for "which kinds you miss". */
export async function loadTypeScores(db: DbOrTx, date: StudyDate, days = 30): Promise<{ type: string; right: number; asked: number }[]> {
  const from = studyDayBounds(addDays(date, -days + 1)).start;
  return rows<{ type: string; right: number; asked: number }>(
    db,
    sql`select q.type::text as type, (count(*) filter (where q.correct))::int as "right", count(*)::int as asked
      from questions q join assessments a on a.id = q.assessment_id
      where a.status = 'submitted' and q.answered_at >= ${from}
      group by 1 order by 1`,
  );
}
