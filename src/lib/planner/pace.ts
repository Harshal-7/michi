/**
 * Pace: how many new items each list gets today so it finishes on time (the plan's "Pace").
 *
 *   quota today = ceil( items not yet started × weight(today) ÷ sum of weight(each study day left) )
 *
 * - Weights come from calendar.ts: 1.0 weekdays, 1.2 weekends, 0 on exam-prep, rest and exam days.
 * - Deadlines come from `settings.listDeadlines`; a deck's own `deadline` overrides them, and
 *   `paceMode = per_day` uses `pacePerDay` instead.
 * - Missed days are not debt: the quota is worked out again every day from what's left.
 * - Items left over when a level's deadline has passed wait until the next phase starts, then get
 *   their own 3-week deadline at the front of the queue.
 * - N3 lists start early at a third of the pace while N4 is projected to finish 2 weeks early.
 * - Caps: 25 words, 6 kanji and 3 grammar points a day; class items come first (up to 15) and
 *   don't count against them; Work Japanese cards join at up to 3 a day.
 * Pure: the database side is store.ts.
 */
import { addDays, daysBetween, type StudyDate } from "@/lib/day";
import type { ItemKind } from "@/lib/items/data";

import { type Calendar, paceWeight, weightBetween } from "./calendar";

export type Level = "N5" | "N4" | "N3";

/** A deck as the planner sees it at the start of the day. */
export type DeckState = {
  id: number;
  slug: string | null;
  name: string;
  source: "starter" | "class" | "immersion" | "user";
  /** What a starter deck holds; null for a mixed deck. */
  kind: ItemKind | null;
  level: Level | null;
  track: "jlpt" | "work";
  active: boolean;
  unlockOn: StudyDate | null;
  paceMode: "deadline" | "per_day";
  pacePerDay: number | null;
  /** The deck's own deadline, overriding the level's. */
  deadline: StudyDate | null;
  /** Every item in the deck, cards or not (progress bars count these). */
  items: number;
  /** Items with an active card, which can be started. */
  total: number;
  /** Items not started before today: one started today still counts, so the quota holds all day. */
  notStarted: number;
  /** Items started on each of the last 14 days before today. */
  startedByDay: Readonly<Record<StudyDate, number>>;
  /** The first of the last 14 days on which a frozen plan gave this deck new items. */
  paceStart: StudyDate | null;
  /** Recalled at an interval of 2 weeks or more. */
  known: number;
  /** Started but not known yet. */
  learning: number;
};

export const DAILY_CAPS: Partial<Record<ItemKind, number>> = { word: 25, kanji: 6, grammar: 3 };
export const CLASS_ITEMS_PER_DAY = 15;
export const WORK_ITEMS_PER_DAY = 3;
export const N3_EARLY_SHARE = 1 / 3;
/** N3 starts early only while N4 is projected to finish this many days before its deadline. */
export const N3_EARLY_MARGIN_DAYS = 14;
/** Leftover items get this many days from the start of the next phase. */
export const LEFTOVER_DAYS = 21;
/** Projections look at the pace of the last two weeks, today's plan included. */
export const PROJECTION_DAYS = 14;
/** Projections stop looking after three years. */
const PROJECTION_LIMIT_DAYS = 3 * 366;

/**
 * Minutes to introduce one item and take it through its first learning steps:
 * "2 kanji and 12 words" is about 15 minutes.
 */
export const NEW_ITEM_MINUTES: Record<ItemKind, number> = { kana: 0.5, kanji: 1.25, word: 1, grammar: 3, phrase: 1 };

/** The starter decks the quick check covers. They get no new items until it's finished. */
export const QUICK_CHECK_DECKS: readonly string[] = ["hiragana", "katakana", "n5-kanji", "n5-words"];

/** On when switched on, or once its unlock date has come. */
export function deckIsOn(deck: Pick<DeckState, "active" | "unlockOn">, date: StudyDate): boolean {
  return deck.active || (deck.unlockOn !== null && daysBetween(deck.unlockOn, date) >= 0);
}

const NEXT_PHASE = { N5: "n4", N4: "n3", N3: "work" } as const;

export type DeadlineState =
  /** Before its deadline. */
  | "on_time"
  /** Past the level's deadline, before the next phase: the last week is for the mock and review. */
  | "waiting"
  /** Past the level's deadline, in the next phase's first 3 weeks. */
  | "leftover"
  /** Past every deadline: whatever is left, up to the caps. */
  | "overdue"
  /** No deadline (a deck of your own on a per-day pace). */
  | "none";

export function deckDeadline(
  deck: Pick<DeckState, "deadline" | "level">,
  date: StudyDate,
  cal: Calendar,
): { deadline: StudyDate | null; state: DeadlineState } {
  const base = deck.deadline ?? (deck.level ? cal.settings.listDeadlines[deck.level] : null);
  if (!base) return { deadline: null, state: "none" };
  if (daysBetween(date, base) >= 0) return { deadline: base, state: "on_time" };
  if (!deck.level || deck.deadline) return { deadline: base, state: "overdue" };
  const nextPhase = cal.settings.phases[NEXT_PHASE[deck.level]].start;
  if (daysBetween(nextPhase, date) < 0) return { deadline: base, state: "waiting" };
  const leftover = addDays(nextPhase, LEFTOVER_DAYS - 1);
  return { deadline: leftover, state: daysBetween(date, leftover) >= 0 ? "leftover" : "overdue" };
}

/** The pace formula for one deck, before caps, the quick check and the day's mode. */
export function formulaQuota(cal: Calendar, date: StudyDate, deck: DeckState): number {
  if (deck.notStarted <= 0) return 0;
  const weight = paceWeight(cal, date);
  if (weight === 0) return 0;
  if (deck.paceMode === "per_day") return Math.min(deck.notStarted, deck.pacePerDay ?? 0);
  const { deadline, state } = deckDeadline(deck, date, cal);
  switch (state) {
    case "none":
      return Math.min(deck.notStarted, deck.pacePerDay ?? 0);
    case "waiting":
      return 0;
    case "overdue":
      return deck.notStarted;
    default:
      return Math.ceil((deck.notStarted * weight) / weightBetween(cal, date, deadline!));
  }
}

export type Priority = "class" | "leftover" | "current" | "early";
const PRIORITY_ORDER: Record<Priority, number> = { class: 0, leftover: 1, current: 2, early: 3 };

export type DeckQuota = {
  deck: DeckState;
  priority: Priority;
  /** The formula's number. */
  formula: number;
  /** After the caps, ignoring the quick check and the day's mode (projections use it). */
  capped: number;
  /** What today gets before the time limit: caps, the quick check and the day's mode applied. */
  quota: number;
};

export type QuotaInput = {
  cal: Calendar;
  date: StudyDate;
  decks: readonly DeckState[];
  quickCheckDone: boolean;
  /** False on exam days, exam prep, recovery, re-entry and rest days. */
  newItemsAllowed: boolean;
};

/** Today's new items per deck, in queue order (class, leftovers, current lists, N3 early start). */
export function paceQuotas(input: QuotaInput): DeckQuota[] {
  const { cal, date, decks } = input;
  const entries: Omit<DeckQuota, "capped" | "quota">[] = [];
  for (const deck of decks) {
    if (deck.source === "class") {
      if (deckIsOn(deck, date) && paceWeight(cal, date) > 0) {
        entries.push({ deck, priority: "class", formula: deck.notStarted });
      }
    } else if (deckIsOn(deck, date)) {
      const { state } = deckDeadline(deck, date, cal);
      const priority = deck.level && (state === "leftover" || state === "overdue") ? "leftover" : "current";
      entries.push({ deck, priority, formula: formulaQuota(cal, date, deck) });
    }
  }
  if (n3EarlyStartOn(cal, date, decks)) {
    for (const deck of decks) {
      if (isN3EarlyDeck(deck) && !deckIsOn(deck, date)) {
        entries.push({ deck, priority: "early", formula: Math.ceil(formulaQuota(cal, date, deck) * N3_EARLY_SHARE) });
      }
    }
  }
  entries.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.deck.id - b.deck.id);

  const gated = (e: (typeof entries)[number]) =>
    !input.newItemsAllowed || (!input.quickCheckDone && QUICK_CHECK_DECKS.includes(e.deck.slug ?? ""));
  const capped = allocate(entries, () => false);
  const quota = allocate(entries, gated);
  return entries.map((e, i) => ({ ...e, capped: capped[i], quota: quota[i] }));
}

/** Applies the caps in queue order; gated entries get nothing and leave their share to the rest. */
function allocate(entries: readonly Omit<DeckQuota, "capped" | "quota">[], gated: (e: (typeof entries)[number]) => boolean) {
  const used: Partial<Record<ItemKind, number>> = {};
  let classUsed = 0;
  let workUsed = 0;
  return entries.map((e) => {
    if (gated(e)) return 0;
    let q = e.formula;
    if (e.priority === "class") {
      q = Math.min(q, CLASS_ITEMS_PER_DAY - classUsed);
      classUsed += q;
      return q;
    }
    if (e.deck.track === "work") {
      q = Math.min(q, WORK_ITEMS_PER_DAY - workUsed);
      workUsed += q;
    }
    const kind = e.deck.kind;
    const cap = kind ? DAILY_CAPS[kind] : undefined;
    if (kind && cap !== undefined) {
      q = Math.min(q, cap - (used[kind] ?? 0));
      used[kind] = (used[kind] ?? 0) + q;
    }
    return q;
  });
}

const isN3EarlyDeck = (deck: DeckState) =>
  deck.source === "starter" && deck.level === "N3" && (deck.kind === "kanji" || deck.kind === "word");

/**
 * N3's early start (decision 9): from `n3EarlyStart` until the N3 phase, only while every N4 list
 * that's on is projected to finish at least 2 weeks before its deadline. Exam prep has no pace
 * weight, so it pauses there too.
 */
export function n3EarlyStartOn(cal: Calendar, date: StudyDate, decks: readonly DeckState[]): boolean {
  const { settings } = cal;
  if (daysBetween(settings.n3EarlyStart, date) < 0 || daysBetween(settings.phases.n3.start, date) >= 0) return false;
  const n4 = decks.filter((d) => d.source === "starter" && d.level === "N4" && deckIsOn(d, date));
  if (n4.length === 0) return false;
  return n4.every((deck) => {
    const { deadline } = deckDeadline(deck, date, cal);
    const rate = paceRate(cal, date, deck, Math.min(formulaQuota(cal, date, deck), capFor(deck)));
    const track = trackFor(cal, date, deck.notStarted, rate, deadline);
    return track.done || (track.finish !== null && deadline !== null && daysBetween(track.finish, deadline) >= N3_EARLY_MARGIN_DAYS);
  });
}

const capFor = (deck: DeckState) => (deck.kind ? (DAILY_CAPS[deck.kind] ?? Infinity) : Infinity);

/**
 * Items per unit of pace weight: what was started since this deck's pace began (at most the last
 * 14 days, which counts missed days as nothing), plus today's plan. With no weight to go on
 * (a rest day on the first day), the formula's own rate.
 */
export function paceRate(cal: Calendar, date: StudyDate, deck: DeckState, plannedToday: number): number {
  let started = plannedToday;
  let weight = paceWeight(cal, date);
  if (deck.paceStart) {
    const windowStart = addDays(date, -(PROJECTION_DAYS - 1));
    const from = daysBetween(windowStart, deck.paceStart) > 0 ? deck.paceStart : windowStart;
    for (let d = from; daysBetween(d, date) > 0; d = addDays(d, 1)) {
      started += deck.startedByDay[d] ?? 0;
      weight += paceWeight(cal, d);
    }
  }
  if (weight > 0) return started / weight;
  const { deadline, state } = deckDeadline(deck, date, cal);
  if ((state === "on_time" || state === "leftover") && deadline) {
    const sum = weightBetween(cal, date, deadline);
    return sum > 0 ? deck.notStarted / sum : 0;
  }
  return 0;
}

/** The day `remaining` items are all started at `rate` per unit of weight, from today on. */
export function projectFinish(cal: Calendar, date: StudyDate, remaining: number, rate: number): StudyDate | null {
  if (remaining <= 0) return date;
  if (rate <= 0) return null;
  let sum = 0;
  let d = date;
  for (let i = 0; i < PROJECTION_LIMIT_DAYS; i++, d = addDays(d, 1)) {
    sum += rate * paceWeight(cal, d);
    if (sum >= remaining - 1e-9) return d;
  }
  return null;
}

export type Tone = "good" | "warn" | "bad";

export type ListTrack = {
  /** Every item started. */
  done: boolean;
  remaining: number;
  /** When the last item is projected to start; null when nothing is moving. */
  finish: StudyDate | null;
  deadline: StudyDate | null;
  /** Days after the deadline the projection lands; 0 when on time. */
  daysBehind: number;
  /** Green on schedule, amber 1–3 days behind, red more (or not moving). */
  tone: Tone;
};

export function toneFor(daysBehind: number): Tone {
  return daysBehind <= 0 ? "good" : daysBehind <= 3 ? "warn" : "bad";
}

export function trackFor(
  cal: Calendar,
  date: StudyDate,
  remaining: number,
  rate: number,
  deadline: StudyDate | null,
): ListTrack {
  if (remaining <= 0) return { done: true, remaining: 0, finish: null, deadline, daysBehind: 0, tone: "good" };
  const finish = projectFinish(cal, date, remaining, rate);
  if (!finish) return { done: false, remaining, finish: null, deadline, daysBehind: 0, tone: "bad" };
  const daysBehind = deadline ? Math.max(0, daysBetween(deadline, finish)) : 0;
  return { done: false, remaining, finish, deadline, daysBehind, tone: toneFor(daysBehind) };
}

/**
 * The on-track marker for one or more decks shown as one bar (hiragana and katakana are "Kana").
 * `planned` is today's frozen quota per deck id; a deck with no pace yet uses its capped quota,
 * so the first days project from the plan rather than from nothing.
 */
export function trackDecks(
  cal: Calendar,
  date: StudyDate,
  decks: readonly DeckState[],
  planned: Readonly<Record<string, number>>,
  capped: Readonly<Record<string, number>> = {},
): ListTrack {
  let remaining = 0;
  let rate = 0;
  let deadline: StudyDate | null = null;
  for (const deck of decks) {
    remaining += deck.notStarted;
    const today = deck.paceStart ? (planned[deck.id] ?? 0) : (planned[deck.id] ?? capped[deck.id] ?? 0);
    rate += paceRate(cal, date, deck, today);
    const own = deckDeadline(deck, date, cal).deadline;
    if (own && (!deadline || daysBetween(deadline, own) > 0)) deadline = own;
  }
  return trackFor(cal, date, remaining, rate, deadline);
}

/** Minutes the new items take. */
export function minutesFor(quotas: readonly { kind: ItemKind | null; quota: number }[]): number {
  return Math.ceil(quotas.reduce((sum, q) => sum + q.quota * (q.kind ? NEW_ITEM_MINUTES[q.kind] : 1), 0));
}

/**
 * Fits the quotas into `minutes`: class items keep their place first, the rest shrink in
 * proportion, and at least one grammar point stays when there was one.
 */
export function scaleToMinutes<T extends { deck: Pick<DeckState, "kind">; priority: Priority; quota: number }>(
  quotas: readonly T[],
  minutes: number,
): (T & { scaled: number })[] {
  const cost = (q: T) => (q.deck.kind ? NEW_ITEM_MINUTES[q.deck.kind] : 1);
  const total = quotas.reduce((s, q) => s + q.quota * cost(q), 0);
  if (total <= minutes) return quotas.map((q) => ({ ...q, scaled: q.quota }));
  const classMinutes = quotas.filter((q) => q.priority === "class").reduce((s, q) => s + q.quota * cost(q), 0);
  let classLeft = Math.max(0, Math.floor(minutes));
  const restShare = classMinutes >= minutes ? 0 : (minutes - classMinutes) / (total - classMinutes);
  const out = quotas.map((q) => {
    if (q.priority === "class") {
      const scaled = Math.min(q.quota, Math.floor(classLeft / cost(q)));
      classLeft -= scaled * cost(q);
      return { ...q, scaled };
    }
    return { ...q, scaled: Math.floor(q.quota * restShare) };
  });
  const grammar = out.filter((q) => q.deck.kind === "grammar" && q.quota > 0);
  if (grammar.length > 0 && grammar.every((q) => q.scaled === 0)) grammar[0].scaled = 1;
  return out;
}
