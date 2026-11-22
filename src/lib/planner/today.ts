/**
 * Everything the Today page shows, worked out on the server: the frozen plan and what's done,
 * the phase and the next exam, the streak, the current level's progress bars, this week planned
 * against done, what's coming up, and tomorrow's preview once today is finished.
 */
import { sql } from "drizzle-orm";

import type { Db } from "@/db/client";
import {
  addDays,
  daysBetween,
  formatDayMonth,
  formatShort,
  PHASE_NAMES,
  phaseFor,
  type StudyDate,
  studyDayBounds,
  weekOf,
} from "@/lib/day";
import type { ItemKind } from "@/lib/items/data";
import type { Settings } from "@/lib/settings/schema";

import { type Calendar, examOn, isClassDay, makeCalendar, MOCK_MINUTES, mockOn, nextExam, type UpcomingExam } from "./calendar";
import type { DayPlan, DayTask } from "./day-plan";
import { type DayActivity, type DayStatus, countsForStreak, evaluate, type TaskStatus } from "./evaluate";
import { type DeckState, type Level, type ListTrack, toneFor, type Tone, trackDecks } from "./pace";
import { planDetail } from "./plan";
import { loadActivity, loadCountedDays, loadDecks, loadMarks, loadPlanInput, loadPlans, loadQuickCheck } from "./store";
import { type Streak, streakOf } from "./streak";

export type TaskRow = {
  key: string;
  kind: DayTask["kind"];
  title: string;
  href: string;
  must: boolean;
  state: TaskStatus["state"];
  /** Marked by hand, so it can be undone. */
  marked: boolean;
  next: boolean;
  /** "64 cards", "2 kanji and 12 words". */
  detail: string;
  /** "done", "skipped", "20 of 64 cards"; null while untouched. */
  note: string | null;
  minutes: number;
};

export type Bar = { key: string; label: string; value: string; pct: number; note: string; tone: Tone };

export type TodayView = {
  date: StudyDate;
  plan: DayPlan;
  status: DayStatus;
  rows: TaskRow[];
  plannedMinutes: number;
  phase: { name: string; daysLeft: number | null; daysGone: number; totalDays: number | null; end: StudyDate | null; start: StudyDate } | null;
  exam: UpcomingExam | null;
  /** The exam on today's date, if it's exam day. */
  examToday: ReturnType<typeof examOn>;
  /** The N5 mock on the phase card on a laptop ("N5 mock on Sat 26 Dec"). */
  phaseMock: StudyDate | null;
  registration: { level: "N4" | "N3"; remindOn: StudyDate; fee: string; hostUrl: string | null } | null;
  /** "register in March", until registration comes round. */
  registerNote: string | null;
  streak: Streak;
  level: Level;
  bars: Bar[];
  week: { label: string; value: string }[];
  comingUp: { title: string; when: string }[];
  /** Once today is finished. */
  done: { minutes: number; items: { title: string; result: string; key: string; marked: boolean }[] } | null;
  tomorrow: { weekday: string; summary: string; note: string | null } | null;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "1 h 40 m", "50 m", "0". */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  if (m <= 0) return "0";
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} h${m % 60 ? ` ${m % 60} m` : ""}` : `${m} m`;
}

const KIND_WORDS: Record<ItemKind, [string, string]> = {
  kana: ["kana", "kana"],
  kanji: ["kanji", "kanji"],
  word: ["word", "words"],
  grammar: ["grammar point", "grammar points"],
  phrase: ["phrase", "phrases"],
};
const KIND_ORDER: ItemKind[] = ["kana", "kanji", "word", "grammar", "phrase"];

/** "2 kanji and 12 words", from a quota per deck id. */
export function newItemsSummary(quota: Readonly<Record<string, number>>, decks: readonly Pick<DeckState, "id" | "kind" | "source">[]): string {
  const byKind = new Map<string, number>();
  for (const [id, n] of Object.entries(quota)) {
    const deck = decks.find((d) => String(d.id) === id);
    const key = deck?.source === "class" ? "class" : (deck?.kind ?? "other");
    byKind.set(key, (byKind.get(key) ?? 0) + n);
  }
  const parts: string[] = [];
  if (byKind.get("class")) parts.push(`${byKind.get("class")} from class`);
  for (const kind of KIND_ORDER) {
    const n = byKind.get(kind);
    if (n) parts.push(`${n} ${KIND_WORDS[kind][n === 1 ? 0 : 1]}`);
  }
  if (byKind.get("other")) parts.push(plural(byKind.get("other")!, "item"));
  if (parts.length === 0) return "nothing new";
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

const DETAILS: Partial<Record<DayTask["kind"], string>> = {
  speaking: "talk, shadow or read aloud, then log it",
  listening: "anime, podcast or NHK Easy, then log it",
  reading: "NHK Easy or Tadoku, then log it",
  log_class: "words, kanji and grammar from class",
  daily_quiz: "10 questions",
  weekly_test: "25 questions on this week",
  mock: "timed like the JLPT",
  work: "keigo, interviews and chat",
};

function rowFor(t: TaskStatus, next: string | null, plan: DayPlan, decks: readonly DeckState[], quickCheckKana: number): TaskRow {
  const { task } = t;
  const target = task.target ?? 0;
  let detail = DETAILS[task.kind] ?? "";
  let unit = "";
  switch (task.kind) {
    case "reviews":
      detail = target > 0 ? plural(target, "card") : "nothing due";
      unit = "cards";
      break;
    case "quick_check":
      detail = quickCheckKana > 0 ? `${plural(target, "item")}, kana first` : `${target} kanji and words`;
      unit = "items";
      break;
    case "new_items":
      detail = newItemsSummary(plan.newQuota, decks);
      unit = "started";
      break;
    case "grammar":
      detail = plural(target, "point");
      break;
    case "class":
      detail = formatMinutes(task.minutes).replace(" m", " min");
      break;
    case "speaking":
    case "listening":
    case "reading":
      unit = "min logged";
      break;
  }
  let note: string | null = null;
  if (t.state === "done") note = "done";
  else if (t.state === "skipped") note = "skipped";
  else if (t.progress && t.progress.done > 0) note = `${t.progress.done} of ${t.progress.of} ${unit}`.trim();
  return {
    key: task.key,
    kind: task.kind,
    title: task.title,
    href: task.href,
    must: task.must,
    state: t.state,
    marked: t.mark !== null && !t.auto,
    next: task.key === next,
    detail,
    note,
    minutes: task.minutes,
  };
}

const LEVEL_FOR_PHASE = { n5: "N5", n4: "N4", n3: "N3", work: "N3" } as const;
const PRACTICE_PHASE = { n5: "n5", n4: "n4", n3: "n3", work: null } as const;

function noteFor(track: ListTrack): Pick<Bar, "note" | "tone"> {
  if (track.done) return { note: "all started", tone: "good" };
  if (!track.finish) return { note: "paused", tone: "bad" };
  const about = `about ${formatDayMonth(track.finish)}`;
  if (track.daysBehind === 0) return { note: `on track · ${about}`, tone: "good" };
  return { note: `${plural(track.daysBehind, "day")} behind · ${about}`, tone: track.tone };
}

/** Listening and speaking: hours against the phase target, spread from when you started. */
function practiceBar(
  key: string,
  label: string,
  minutes: number,
  targetHours: number,
  from: StudyDate,
  end: StudyDate | null,
  today: StudyDate,
): Bar {
  const hours = minutes / 60;
  const value = `${hours.toFixed(1).replace(/\.0$/, "")} / ${targetHours} h`;
  const pct = targetHours > 0 ? Math.min(100, Math.round((hours / targetHours) * 100)) : 0;
  if (hours >= targetHours) return { key, label, value, pct, note: "target reached", tone: "good" };
  const totalDays = end ? daysBetween(from, end) + 1 : 1;
  const perDay = (targetHours * 60) / Math.max(1, totalDays);
  const expected = perDay * Math.max(0, daysBetween(from, today));
  const behind = Math.floor((expected - minutes) / perDay);
  const elapsed = daysBetween(from, today) + 1;
  const rate = minutes / elapsed;
  const finish = rate > 0 ? addDays(today, Math.ceil((targetHours * 60 - minutes) / rate)) : null;
  const about = finish ? ` · about ${formatDayMonth(finish)}` : "";
  if (behind <= 0) return { key, label, value, pct, note: `on track${about}`, tone: "good" };
  return { key, label, value, pct, note: `${plural(behind, "day")} behind${about}`, tone: toneFor(behind) };
}

type Q = Record<string, unknown>;
async function rows<T extends Q>(db: Db, query: ReturnType<typeof sql>): Promise<T[]> {
  return (await db.execute<T>(query)).rows as T[];
}

export async function loadToday(db: Db, plan: DayPlan): Promise<TodayView> {
  const date = plan.date;
  const week = weekOf(date);
  const [activity, marks, counted, input] = await Promise.all([
    loadActivity(db, plan),
    loadMarks(db, date),
    loadCountedDays(db, date),
    loadPlanInput(db, date),
  ]);
  const { settings, decks } = input;
  const cal = makeCalendar(settings, input.exceptions);
  const status = evaluate(plan, activity, marks);
  const quickCheckKana = input.quickCheck.remainingKana;
  const rows_ = status.tasks.map((t) => rowFor(t, status.next, plan, decks, quickCheckKana));

  // Streak: today joins once its streak tasks are done.
  if (countsForStreak(status) && plan.tasks.length > 0) counted.counted.add(date);
  const streak = streakOf(counted.counted, counted.first ?? date, date);

  const phase = phaseFor(date, settings);
  const level: Level = phase ? LEVEL_FOR_PHASE[phase.id] : "N5";
  const exam = nextExam(cal, date);

  const [bars, weekStats, tomorrow] = await Promise.all([
    progressBars(db, cal, date, plan, decks, level, phase, counted.first ?? date, input),
    thisWeek(db, date, week, streak),
    status.finished ? tomorrowPreview(db, cal, date, settings) : Promise.resolve(null),
  ]);

  const registration = registrationDue(settings, date, exam);
  const phaseMock = phase?.id === "n5" ? findMock(cal, date, 45, "N5") : null;

  return {
    date,
    plan,
    status,
    rows: rows_,
    plannedMinutes: plan.tasks.reduce((s, t) => s + t.minutes, 0),
    phase: phase
      ? {
          name: PHASE_NAMES[phase.id],
          start: phase.start,
          end: phase.end,
          daysLeft: phase.end ? daysBetween(date, phase.end) + 1 : null,
          daysGone: daysBetween(phase.start, date),
          totalDays: phase.end ? daysBetween(phase.start, phase.end) + 1 : null,
        }
      : null,
    exam,
    examToday: examOn(cal, date),
    phaseMock,
    registration,
    registerNote: registerNote(settings, date, exam),
    streak,
    level,
    bars,
    week: weekStats,
    comingUp: comingUp(cal, date, settings),
    done: status.finished ? doneSummary(status, activity, plan, decks) : null,
    tomorrow,
  };
}

function registrationDue(settings: Settings, date: StudyDate, exam: UpcomingExam | null): TodayView["registration"] {
  if (!exam) return null;
  const reg = settings.registration[exam.level];
  if (reg.registered || daysBetween(reg.remindOn, date) < 0) return null;
  return { level: exam.level, remindOn: reg.remindOn, fee: exam.level === "N4" ? "₹2,200" : "₹2,500", hostUrl: settings.registration.hostUrl };
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function registerNote(settings: Settings, date: StudyDate, exam: UpcomingExam | null): string | null {
  if (!exam) return null;
  const reg = settings.registration[exam.level];
  if (reg.registered || daysBetween(date, reg.remindOn) <= 0) return null;
  return `register in ${MONTH_NAMES[Number(reg.remindOn.slice(5, 7)) - 1]}`;
}

function findMock(cal: Calendar, from: StudyDate, days: number, level?: string): StudyDate | null {
  for (let i = 0; i <= days; i++) {
    const d = addDays(from, i);
    const mock = mockOn(cal, d);
    if (mock && (!level || mock === level)) return d;
  }
  return null;
}

async function progressBars(
  db: Db,
  cal: Calendar,
  date: StudyDate,
  plan: DayPlan,
  decks: readonly DeckState[],
  level: Level,
  phase: ReturnType<typeof phaseFor>,
  firstDay: StudyDate,
  input: Awaited<ReturnType<typeof loadPlanInput>>,
): Promise<Bar[]> {
  const starter = (kind: ItemKind) => decks.filter((d) => d.source === "starter" && d.level === level && d.kind === kind);
  // Lists that haven't had a plan yet project from the quota they'd get today.
  const capped = Object.fromEntries(planDetail(input).quotas.map((q) => [String(q.deck.id), q.capped]));
  const listBar = (key: string, label: string, list: DeckState[], value: (known: number, items: number) => string, known?: number): Bar | null => {
    if (list.length === 0) return null;
    const items = list.reduce((s, d) => s + d.items, 0);
    const k = known ?? list.reduce((s, d) => s + d.known, 0);
    const track = trackDecks(cal, date, list, plan.newQuota, capped);
    return { key, label, value: value(k, items), pct: items > 0 ? Math.round((k / items) * 100) : 0, ...noteFor(track) };
  };
  const grammarDecks = starter("grammar");
  const [confident] = grammarDecks.length
    ? await rows<{ n: number }>(
        db,
        sql`select count(*)::int as n from grammar_progress gp join deck_items di on di.item_id = gp.item_id
          where gp.status = 'confident' and di.deck_id in (${sql.join(grammarDecks.map((d) => sql`${d.id}`), sql`, `)})`,
      )
    : [{ n: 0 }];
  const fraction = (k: number, n: number) => `${k} / ${n}`;
  const bars = [
    level === "N5" ? listBar("kana", "Kana", decks.filter((d) => d.slug === "hiragana" || d.slug === "katakana"), (k, n) => `${n ? Math.round((k / n) * 100) : 0}%`) : null,
    listBar("kanji", "Kanji", starter("kanji"), fraction),
    listBar("vocab", "Vocab", starter("word"), fraction),
    listBar("grammar", "Grammar", grammarDecks, fraction, confident.n),
  ].filter((b): b is Bar => b !== null);

  const practice = phase ? PRACTICE_PHASE[phase.id] : null;
  if (phase && practice) {
    const from = daysBetween(phase.start, firstDay) > 0 ? firstDay : phase.start;
    const minutes = await rows<{ skill: string; minutes: number }>(
      db,
      sql`select skill, sum(minutes)::int as minutes from activity_logs
        where kind <> 'class' and study_date >= ${from}::date and study_date <= ${date}::date
          and skill in ('listening', 'speaking')
        group by skill`,
    );
    const by = Object.fromEntries(minutes.map((m) => [m.skill, m.minutes]));
    const target = cal.settings.practiceTargets[practice];
    bars.push(practiceBar("listening", "Listening", by.listening ?? 0, target.listeningHours, from, phase.end, date));
    bars.push(practiceBar("speaking", "Speaking", by.speaking ?? 0, target.speakingHours, from, phase.end, date));
  }
  return bars;
}

async function thisWeek(db: Db, date: StudyDate, week: { start: StudyDate; end: StudyDate }, streak: Streak) {
  const { start } = studyDayBounds(week.start);
  const { end } = studyDayBounds(date);
  const [plans, [reviews], [minutes], [introduced]] = await Promise.all([
    loadPlans(db, week.start, date),
    rows<{ n: number; recalled: number; ms: number }>(
      db,
      sql`select count(*)::int as n, (count(*) filter (where rating > 1))::int as recalled,
          coalesce(sum(duration_ms), 0)::float8 as ms
        from review_logs where voided_at is null and reviewed_at >= ${start} and reviewed_at < ${end}`,
    ),
    rows<{ all: number; listening: number; speaking: number }>(
      db,
      sql`select coalesce(sum(minutes), 0)::int as all,
          coalesce(sum(minutes) filter (where skill = 'listening' and kind <> 'class'), 0)::int as listening,
          coalesce(sum(minutes) filter (where skill = 'speaking' and kind <> 'class'), 0)::int as speaking
        from activity_logs where study_date >= ${week.start}::date and study_date <= ${date}::date`,
    ),
    rows<{ n: number }>(
      db,
      sql`select count(*)::int as n from cards where introduced_on >= ${week.start}::date and introduced_on <= ${date}::date`,
    ),
  ]);
  const plannedMinutes = plans.reduce((s, p) => s + p.tasks.reduce((t, x) => t + x.minutes, 0), 0);
  const plannedNew = plans.reduce((s, p) => s + Object.values(p.newQuota).reduce((a, b) => a + b, 0), 0);
  const doneMinutes = reviews.ms / 60000 + minutes.all;
  const recall = reviews.n > 0 ? Math.round((reviews.recalled / reviews.n) * 100) : null;
  return [
    { label: "days studied", value: `${streak.thisWeek} of 7` },
    { label: `study time · ${formatMinutes(plannedMinutes)} planned`, value: formatMinutes(doneMinutes) },
    { label: recall === null ? "reviews" : `reviews · ${recall}% recalled`, value: String(reviews.n) },
    { label: `new items · ${plannedNew} planned`, value: String(introduced.n) },
    { label: "listening", value: formatMinutes(minutes.listening) },
    { label: "speaking", value: formatMinutes(minutes.speaking) },
  ];
}

/** The next few dates worth knowing about: a mock, the first class, the next phase, registration, the exam. */
function comingUp(cal: Calendar, date: StudyDate, settings: Settings): { title: string; when: string }[] {
  const events: { date: StudyDate; title: string; extra?: string }[] = [];
  const mock = findMock(cal, addDays(date, 1), 120);
  if (mock) {
    const level = mockOn(cal, mock)!;
    events.push({ date: mock, title: `${level} mock test`, extra: `${MOCK_MINUTES[level]} min` });
  }
  if (daysBetween(date, settings.classes.startsOn) > 0) {
    let first = settings.classes.startsOn;
    for (let i = 0; i < 7 && !isClassDay(cal, first); i++) first = addDays(first, 1);
    events.push({ date: first, title: "First class" });
  }
  const phase = phaseFor(date, settings);
  if (phase?.end) {
    const nextStart = addDays(phase.end, 1);
    const next = phaseFor(nextStart, settings);
    if (next) events.push({ date: nextStart, title: `${PHASE_NAMES[next.id]} starts` });
  }
  for (const level of ["N4", "N3"] as const) {
    const reg = settings.registration[level];
    if (!reg.registered && daysBetween(date, reg.remindOn) > 0) events.push({ date: reg.remindOn, title: `JLPT ${level} registration`, extra: "about then" });
    const exam = settings.exams[level];
    if (daysBetween(date, exam.date) > 0) events.push({ date: exam.date, title: `JLPT ${level}`, extra: exam.confirmed ? undefined : "expected" });
  }
  return events
    .sort((a, b) => daysBetween(b.date, a.date))
    .slice(0, 3)
    .map((e) => ({ title: e.title, when: [formatShort(e.date, date), e.extra].filter(Boolean).join(" · ") }));
}

function doneSummary(status: DayStatus, activity: DayActivity, plan: DayPlan, decks: readonly DeckState[]): NonNullable<TodayView["done"]> {
  const result = (t: TaskStatus): string => {
    if (t.state === "skipped") return "skipped";
    switch (t.task.kind) {
      case "reviews":
        return t.task.target ? plural(Math.max(activity.reviewsGraded, t.task.target), "card") : "nothing due";
      case "new_items":
        return newItemsSummary(plan.newQuota, decks);
      case "quick_check":
        return plural(activity.quickChecked, "item");
      case "speaking":
      case "listening":
      case "reading": {
        const m = activity.minutes[t.task.kind] ?? 0;
        return m > 0 ? `${m} min` : "done";
      }
      default:
        return "done";
    }
  };
  const minutes =
    activity.reviewMinutes +
    (activity.minutes.listening ?? 0) +
    (activity.minutes.speaking ?? 0) +
    (activity.minutes.reading ?? 0) +
    status.tasks
      .filter((t) => t.state === "done" && (t.task.kind === "new_items" || t.task.kind === "quick_check"))
      .reduce((s, t) => s + t.task.minutes, 0);
  return {
    minutes,
    items: status.tasks.map((t) => ({ key: t.task.key, title: t.task.title, result: result(t), marked: t.mark !== null && !t.auto })),
  };
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Tomorrow's plan as it looks now: reviews falling due by tomorrow night and the pace from here. */
async function tomorrowPreview(db: Db, cal: Calendar, date: StudyDate, settings: Settings): Promise<TodayView["tomorrow"]> {
  const tomorrow = addDays(date, 1);
  const { end } = studyDayBounds(tomorrow);
  const [decks, [due], qc, exceptions] = await Promise.all([
    loadDecks(db, tomorrow),
    rows<{ due: number; learning: number }>(
      db,
      sql`select count(*)::int as due,
          (count(*) filter (where state in ('learning', 'relearning')))::int as learning
        from cards where status = 'active' and state <> 'new' and due_at < ${end}`,
    ),
    loadQuickCheck(db, date),
    Promise.resolve([...cal.overrides].map(([d, kind]) => ({ date: d, kind }))),
  ]);
  const { plan, mode } = planDetail({
    date: tomorrow,
    settings,
    exceptions,
    reviews: { due: due.due, learningDue: due.learning },
    lastActiveDate: date,
    decks,
    quickCheck: { remainingKana: qc.leftKana, remainingOther: qc.leftOther, startedOn: qc.startedOn ?? date },
  });
  const weekday = WEEKDAY_NAMES[new Date(`${tomorrow}T00:00:00Z`).getUTCDay()];
  if (mode === "exam_day") return { weekday, summary: "Exam day: the exam is the only thing on.", note: null };
  const minutes = plan.tasks.reduce((s, t) => s + t.minutes, 0);
  const parts: string[] = [];
  const reviews = plan.tasks.find((t) => t.kind === "reviews");
  if (reviews?.target) parts.push(plural(reviews.target, "review"));
  const qcTask = plan.tasks.find((t) => t.kind === "quick_check");
  if (qcTask) parts.push(`the quick check (${plural(qcTask.target ?? 0, "item")})`);
  if (Object.keys(plan.newQuota).length) parts.push(newItemsSummary(plan.newQuota, decks));
  const summary = `About ${minutes} minutes${parts.length ? `: ${parts.join(", ")}` : ""}.`;
  const notes: Partial<Record<string, string>> = {
    rest: "It's a rest day: just a few reviews.",
    recovery: "Reviews first, no new items until the pile is down.",
    exam_prep: "Exam prep: no new items, more listening.",
  };
  const upcoming = comingUp(cal, date, settings)[0];
  return { weekday, summary, note: notes[mode] ?? (upcoming ? `${upcoming.title}: ${upcoming.when}.` : null) };
}
