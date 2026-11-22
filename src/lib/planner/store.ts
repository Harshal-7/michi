/**
 * The planner's database side: gathers plan.ts's input and evaluate.ts's activity for a study
 * date, and the history the streak needs. Everything is counted "as of the start of the day"
 * where the plan needs it (reviews done today still count as due, items started today as not
 * started), so a plan built or rebuilt at any hour of the day comes out the same.
 */
import { and, asc, eq, gte, lt, lte, type SQL, sql } from "drizzle-orm";

import type { DbOrTx } from "@/db/client";
import { calendarOverrides, dayPlans, decks, taskOverrides } from "@/db/schema";
import { getSettings } from "@/db/settings";
import { addDays, type StudyDate, studyDayBounds } from "@/lib/day";
import type { ItemKind } from "@/lib/items/data";

import type { CalendarException } from "./calendar";
import { DayPlan } from "./day-plan";
import { carryOver, CARRY_OVER_KINDS, countsForStreak, type DayActivity, evaluate, STREAK_KINDS, type TaskMark } from "./evaluate";
import { type DeckState, type Level, PROJECTION_DAYS, QUICK_CHECK_DECKS, READ_THROUGH_DECKS } from "./pace";
import type { PlanInput } from "./plan";

type Row = Record<string, unknown>;
async function rows<T extends Row>(db: DbOrTx, query: SQL): Promise<T[]> {
  const result = await db.execute<T>(query);
  return result.rows as T[];
}
async function one<T extends Row>(db: DbOrTx, query: SQL): Promise<T> {
  return (await rows<T>(db, query))[0];
}
const list = (values: readonly unknown[]) => sql.join(values.map((v) => sql`${v}`), sql`, `);

/**
 * Per item, over its active cards: started (any card past new), started before `date`, the
 * first day one was introduced, and known (every card recalled at an interval of 2 weeks or more).
 */
const itemState = (date: StudyDate) => sql`
  item_state as (
    select c.item_id,
      bool_or(c.state <> 'new') as started,
      bool_or(c.state <> 'new' and (c.introduced_on is null or c.introduced_on < ${date}::date)) as started_before,
      min(c.introduced_on) as first_on,
      bool_and(c.state = 'review' and c.due_at - c.last_review_at >= interval '14 days') as known
    from cards c
    where c.status = 'active'
    group by c.item_id
  )`;

/** The calendar exceptions, all of them: future ones change the pace weights. */
export async function loadExceptions(db: DbOrTx): Promise<CalendarException[]> {
  return db
    .select({ date: calendarOverrides.date, kind: calendarOverrides.kind })
    .from(calendarOverrides)
    .orderBy(asc(calendarOverrides.date));
}

/** Every deck with its counts as of the start of `date`. */
export async function loadDecks(db: DbOrTx, date: StudyDate): Promise<DeckState[]> {
  const from = addDays(date, -PROJECTION_DAYS);
  const [deckRows, counts, started, plans] = await Promise.all([
    db.select().from(decks).orderBy(asc(decks.position), asc(decks.id)),
    rows<{ deck_id: number; items: number; total: number; not_started: number; known: number; learning: number }>(
      db,
      sql`with ${itemState(date)}
        select di.deck_id,
          count(*)::int as items,
          count(s.item_id)::int as total,
          (count(s.item_id) filter (where not s.started_before))::int as not_started,
          (count(s.item_id) filter (where s.known))::int as known,
          (count(s.item_id) filter (where s.started and not s.known))::int as learning
        from deck_items di left join item_state s on s.item_id = di.item_id
        group by di.deck_id`,
    ),
    rows<{ deck_id: number; day: string; n: number }>(
      db,
      sql`with ${itemState(date)}
        select di.deck_id, s.first_on::text as day, count(*)::int as n
        from deck_items di join item_state s on s.item_id = di.item_id
        where s.first_on >= ${from}::date and s.first_on < ${date}::date
        group by 1, 2`,
    ),
    db
      .select({ studyDate: dayPlans.studyDate, plan: dayPlans.plan })
      .from(dayPlans)
      .where(and(gte(dayPlans.studyDate, from), lt(dayPlans.studyDate, date)))
      .orderBy(asc(dayPlans.studyDate)),
  ]);
  const countBy = new Map(counts.map((c) => [c.deck_id, c]));
  const paceStart = new Map<number, StudyDate>();
  for (const row of plans) {
    const parsed = DayPlan.safeParse(row.plan);
    if (!parsed.success) continue;
    for (const [id, quota] of Object.entries(parsed.data.newQuota)) {
      if (quota > 0 && !paceStart.has(Number(id))) paceStart.set(Number(id), row.studyDate);
    }
  }
  return deckRows.map((d) => {
    const c = countBy.get(d.id);
    const startedByDay: Record<StudyDate, number> = {};
    for (const s of started) if (s.deck_id === d.id) startedByDay[s.day] = s.n;
    return {
      id: d.id,
      slug: d.slug,
      name: d.name,
      source: d.source,
      kind: d.kind as ItemKind | null,
      level: d.level as Level | null,
      track: d.track,
      active: d.active,
      unlockOn: d.unlockOn,
      paceMode: d.paceMode,
      pacePerDay: d.pacePerDay,
      deadline: d.deadline,
      items: c?.items ?? 0,
      total: c?.total ?? 0,
      notStarted: c?.not_started ?? 0,
      startedByDay,
      paceStart: paceStart.get(d.id) ?? null,
      known: c?.known ?? 0,
      learning: c?.learning ?? 0,
    };
  });
}

/** Cards due by the end of `date`: now, at the start of the day (graded ones added back), and learning. */
export async function loadReviewCounts(db: DbOrTx, date: StudyDate) {
  const { end } = studyDayBounds(date);
  return one<{ due_now: number; due_start: number; learning_due: number }>(
    db,
    sql`select
        (count(*) filter (where c.due_at < ${end}))::int as due_now,
        (count(*) filter (where c.due_at < ${end} or g.card_id is not null))::int as due_start,
        (count(*) filter (where c.due_at < ${end} and c.state in ('learning', 'relearning')))::int as learning_due
      from cards c
      left join (
        select distinct card_id from review_logs
        where study_date = ${date}::date and source = 'session' and voided_at is null
      ) g on g.card_id = c.id
      where c.status = 'active' and c.state <> 'new' and c.introduced_on is distinct from ${date}::date`,
  );
}

/**
 * The quick check's items left now, and how many it covered on `date`, kana apart. With
 * READ_THROUGH_DECKS, the same for the N5 grammar read-through (its lessons are all "other").
 */
export async function loadQuickCheck(db: DbOrTx, date: StudyDate, deckSlugs: readonly string[] = QUICK_CHECK_DECKS) {
  const { start, end } = studyDayBounds(date);
  const r = await one<{
    left_kana: number;
    left_other: number;
    today_kana: number;
    today_other: number;
    started_on: string | null;
  }>(
    db,
    sql`with ${itemState(date)},
      qc_items as (
        select distinct di.item_id from deck_items di join decks d on d.id = di.deck_id
        where d.slug in (${list(deckSlugs)})
      )
      select
        (count(*) filter (where q.item_id is null and not coalesce(s.started, false) and i.kind = 'kana'))::int as left_kana,
        (count(*) filter (where q.item_id is null and not coalesce(s.started, false) and i.kind <> 'kana'))::int as left_other,
        (count(*) filter (where q.checked_at >= ${start} and q.checked_at < ${end} and i.kind = 'kana'))::int as today_kana,
        (count(*) filter (where q.checked_at >= ${start} and q.checked_at < ${end} and i.kind <> 'kana'))::int as today_other,
        ((min(q.checked_at) at time zone 'UTC') + interval '90 minutes')::date::text as started_on
      from qc_items x
      join items i on i.id = x.item_id
      left join quick_check q on q.item_id = x.item_id
      left join item_state s on s.item_id = x.item_id`,
  );
  return {
    leftKana: r.left_kana,
    leftOther: r.left_other,
    todayKana: r.today_kana,
    todayOther: r.today_other,
    startedOn: r.started_on,
  };
}

/** The last day before `date` with any reviews or logged minutes. */
export async function loadLastActiveDate(db: DbOrTx, date: StudyDate): Promise<StudyDate | null> {
  const r = await one<{ last: string | null }>(
    db,
    sql`select greatest(
        (select max(study_date) from review_logs where voided_at is null and study_date < ${date}::date),
        (select max(study_date) from activity_logs where study_date < ${date}::date)
      )::text as last`,
  );
  return r.last;
}

/** A stored plan, or null when there's none or it no longer reads as a plan. */
export async function loadPlan(db: DbOrTx, date: StudyDate): Promise<DayPlan | null> {
  const [row] = await db.select({ plan: dayPlans.plan }).from(dayPlans).where(eq(dayPlans.studyDate, date)).limit(1);
  const parsed = row ? DayPlan.safeParse(row.plan) : null;
  return parsed?.success ? parsed.data : null;
}

export async function loadMarks(db: DbOrTx, date: StudyDate): Promise<Record<string, TaskMark>> {
  const marks = await db
    .select({ key: taskOverrides.taskKey, mark: taskOverrides.mark })
    .from(taskOverrides)
    .where(eq(taskOverrides.studyDate, date));
  return Object.fromEntries(marks.map((m) => [m.key, m.mark]));
}

/** Everything plan() needs for `date`. */
export async function loadPlanInput(db: DbOrTx, date: StudyDate): Promise<PlanInput> {
  const [settings, exceptions, reviews, lastActiveDate, deckStates, quickCheck, readThrough, carried] = await Promise.all([
    getSettings(db),
    loadExceptions(db),
    loadReviewCounts(db, date),
    loadLastActiveDate(db, date),
    loadDecks(db, date),
    loadQuickCheck(db, date),
    loadQuickCheck(db, date, READ_THROUGH_DECKS),
    loadCarryOver(db, date),
  ]);
  return {
    date,
    settings,
    exceptions,
    reviews: { due: reviews.due_start, learningDue: reviews.learning_due },
    lastActiveDate,
    decks: deckStates,
    quickCheck: {
      remainingKana: quickCheck.leftKana + quickCheck.todayKana,
      remainingOther: quickCheck.leftOther + quickCheck.todayOther,
      startedOn: quickCheck.startedOn,
    },
    readThrough: { remaining: readThrough.leftOther + readThrough.todayOther, startedOn: readThrough.startedOn },
    carryOver: carried,
  };
}

/** Yesterday's unfinished tasks that carry over to `date`. */
async function loadCarryOver(db: DbOrTx, date: StudyDate) {
  const yesterday = addDays(date, -1);
  const plan = await loadPlan(db, yesterday);
  if (!plan || !plan.tasks.some((t) => CARRY_OVER_KINDS.includes(t.kind))) return [];
  const [activity, marks] = await Promise.all([loadActivity(db, plan), loadMarks(db, yesterday)]);
  return carryOver(evaluate(plan, activity, marks), date);
}

/** What happened on the plan's day, for evaluate(). Only asks about the kinds of task the plan has. */
export async function loadActivity(db: DbOrTx, plan: DayPlan): Promise<DayActivity> {
  const date = plan.date;
  const { start, end } = studyDayBounds(date);
  const kinds = new Set(plan.tasks.map((t) => t.kind));
  const quotaDecks = Object.keys(plan.newQuota).map(Number);
  const keyDates = (kind: string) =>
    plan.tasks.filter((t) => t.kind === kind).map((t) => t.key.split(":")[1] ?? date);
  const classDates = [...keyDates("class"), ...keyDates("log_class")];
  const weekStarts = keyDates("weekly_test");

  const [reviews, graded, introduced, quickCheck, minutes, classLogs, assessments, grammar, readThrough] = await Promise.all([
    loadReviewCounts(db, date),
    one<{ graded: number; ms: number }>(
      db,
      sql`select count(distinct rl.card_id)::int as graded, coalesce(sum(rl.duration_ms), 0)::float8 as ms
        from review_logs rl join cards c on c.id = rl.card_id
        where rl.study_date = ${date}::date and rl.source = 'session' and rl.voided_at is null
          and c.introduced_on is distinct from ${date}::date`,
    ),
    quotaDecks.length === 0
      ? Promise.resolve({ n: 0 })
      : one<{ n: number }>(
          db,
          sql`select count(distinct c.id)::int as n
            from cards c join deck_items di on di.item_id = c.item_id
            where c.introduced_on = ${date}::date and di.deck_id in (${list(quotaDecks)})`,
        ),
    kinds.has("quick_check") ? loadQuickCheck(db, date) : Promise.resolve(null),
    rows<{ skill: string; minutes: number }>(
      db,
      sql`select skill, sum(minutes)::int as minutes from activity_logs
        where study_date = ${date}::date and kind <> 'class' group by skill`,
    ),
    classDates.length === 0
      ? Promise.resolve([])
      : rows<{ date: string }>(db, sql`select distinct date::text as date from class_logs where date in (${list(classDates)})`),
    kinds.has("daily_quiz") || kinds.has("mock") || weekStarts.length > 0
      ? rows<{ kind: string; study_date: string; week_start: string | null }>(
          db,
          sql`select kind, study_date::text as study_date, week_start::text as week_start from assessments
            where status = 'submitted' and (study_date = ${date}::date or kind = 'weekly')`,
        )
      : Promise.resolve([]),
    kinds.has("grammar")
      ? one<{ touched: boolean }>(
          db,
          sql`select exists(select 1 from grammar_progress where updated_at >= ${start} and updated_at < ${end})
            or exists(select 1 from user_sentences where created_at >= ${start} and created_at < ${end}) as touched`,
        )
      : Promise.resolve({ touched: false }),
    kinds.has("read_through") ? loadQuickCheck(db, date, READ_THROUGH_DECKS) : Promise.resolve(null),
  ]);
  const bySkill = Object.fromEntries(minutes.map((m) => [m.skill, m.minutes]));
  return {
    reviewsGraded: graded.graded,
    reviewsDueNow: reviews.due_now,
    reviewMinutes: Math.round(graded.ms / 60000),
    introduced: introduced.n,
    quickChecked: quickCheck ? quickCheck.todayKana + quickCheck.todayOther : 0,
    quickCheckLeft: quickCheck ? quickCheck.leftKana + quickCheck.leftOther : 0,
    minutes: { listening: bySkill.listening, speaking: bySkill.speaking, reading: bySkill.reading },
    classLogDates: classLogs.map((c) => c.date),
    quizSubmitted: assessments.some((a) => a.kind === "daily" && a.study_date === date),
    weeklySubmitted: assessments.filter((a) => a.kind === "weekly" && a.week_start).map((a) => a.week_start!),
    mockSubmitted: assessments.some((a) => a.kind === "mock" && a.study_date === date),
    grammarTouched: grammar.touched,
    lessonsRead: readThrough ? readThrough.todayOther : 0,
    lessonsLeft: readThrough ? readThrough.leftOther : 0,
  };
}

/** A past day: "nothing due" can't be known any more, so it never counts as done that way. */
const NO_PAST_ACTIVITY: DayActivity = {
  reviewsGraded: 0,
  reviewsDueNow: Number.POSITIVE_INFINITY,
  reviewMinutes: 0,
  introduced: 0,
  quickChecked: 0,
  quickCheckLeft: Number.POSITIVE_INFINITY,
  minutes: {},
  classLogDates: [],
  quizSubmitted: false,
  weeklySubmitted: [],
  mockSubmitted: false,
  grammarTouched: false,
  lessonsRead: 0,
  lessonsLeft: Number.POSITIVE_INFINITY,
};

/**
 * The days that count towards the streak, before `today`, worked out from each day's frozen
 * plan: its streak tasks done from that day's grades and quizzes, or marked done by hand.
 */
export async function loadCountedDays(db: DbOrTx, today: StudyDate): Promise<{ counted: Set<StudyDate>; first: StudyDate | null }> {
  const [plans, graded, quizzes, marks] = await Promise.all([
    rows<{ date: string; tasks: unknown[] }>(
      db,
      sql`select p.study_date::text as date,
          (select coalesce(jsonb_agg(t), '[]'::jsonb) from jsonb_array_elements(p.plan -> 'tasks') t
            where t ->> 'kind' in (${list(STREAK_KINDS)})) as tasks
        from day_plans p where p.study_date < ${today}::date order by 1`,
    ),
    rows<{ date: string; graded: number }>(
      db,
      sql`select rl.study_date::text as date, count(distinct rl.card_id)::int as graded
        from review_logs rl join cards c on c.id = rl.card_id
        where rl.source = 'session' and rl.voided_at is null and rl.study_date < ${today}::date
          and c.introduced_on is distinct from rl.study_date
        group by 1`,
    ),
    rows<{ date: string }>(
      db,
      sql`select study_date::text as date from assessments
        where kind = 'daily' and status = 'submitted' and study_date < ${today}::date`,
    ),
    db
      .select({ date: taskOverrides.studyDate, key: taskOverrides.taskKey, mark: taskOverrides.mark })
      .from(taskOverrides)
      .where(and(lt(taskOverrides.studyDate, today), sql`${taskOverrides.taskKey} in (${list(STREAK_KINDS)})`)),
  ]);
  const gradedOn = new Map(graded.map((g) => [g.date, g.graded]));
  const quizOn = new Set(quizzes.map((q) => q.date));
  const marksOn = new Map<StudyDate, Record<string, TaskMark>>();
  for (const m of marks) marksOn.set(m.date, { ...marksOn.get(m.date), [m.key]: m.mark });
  const counted = new Set<StudyDate>();
  for (const p of plans) {
    const tasks = DayPlan.shape.tasks.safeParse(p.tasks);
    if (!tasks.success) continue;
    const status = evaluate(
      { tasks: tasks.data },
      {
        ...NO_PAST_ACTIVITY,
        reviewsGraded: gradedOn.get(p.date) ?? 0,
        quizSubmitted: quizOn.has(p.date),
      },
      marksOn.get(p.date),
    );
    if (countsForStreak(status)) counted.add(p.date);
  }
  const first = plans[0]?.date ?? null;
  return { counted, first };
}

/** Plans from `from` to `to`, both included. */
export async function loadPlans(db: DbOrTx, from: StudyDate, to: StudyDate): Promise<DayPlan[]> {
  const found = await db
    .select({ plan: dayPlans.plan })
    .from(dayPlans)
    .where(and(gte(dayPlans.studyDate, from), lte(dayPlans.studyDate, to)))
    .orderBy(asc(dayPlans.studyDate));
  return found.flatMap((r) => {
    const parsed = DayPlan.safeParse(r.plan);
    return parsed.success ? [parsed.data] : [];
  });
}
