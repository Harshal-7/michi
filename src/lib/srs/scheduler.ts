/**
 * FSRS through ts-fsrs 6, the same code in the browser and on the server.
 *
 * The browser runs it for the interval labels on the rating buttons and to know at once where a
 * graded card goes next. The server runs it again from the stored card when the grade arrives,
 * and its result is what's saved. Both give the same answer because the inputs are the same:
 * the stored card, the grade, the moment of the grade, and the card's database id (ts-fsrs seeds
 * its fuzzing with the card id and the review count).
 *
 * Settings supply the target recall and the learning steps (decision 4: 90%, 1 min and 10 min).
 * `allowModelOverride: false` keeps those steps: FSRS-7 would otherwise skip them for a card it
 * expects you to remember for days.
 */
import { DefaultScheduler, type DefaultSchedulerCard } from "ts-fsrs";

export const CARD_STATES = ["new", "learning", "review", "relearning"] as const;
export type CardState = (typeof CARD_STATES)[number];

/** 1 Again, 2 Hard, 3 Good, 4 Easy: the values ts-fsrs and review_logs.rating use. */
export const GRADES = [1, 2, 3, 4] as const;
export type Grade = (typeof GRADES)[number];
export const GRADE_NAMES: Record<Grade, string> = { 1: "Again", 2: "Hard", 3: "Good", 4: "Easy" };

export const isGrade = (value: unknown): value is Grade => GRADES.includes(value as Grade);

/** The part of the settings FSRS needs (src/lib/settings/schema.ts). */
export type FsrsSettings = { targetRecall: number; learningSteps: string[] };

type StepUnit = `${number}${"m" | "h" | "d"}`;

/** The scheduler's options for these settings. */
export function schedulerOptions(settings: FsrsSettings) {
  return {
    version: "FSRS-7" as const,
    desiredRetention: settings.targetRecall,
    // ts-fsrs takes minutes, hours and days; the settings may also hold seconds ("30s").
    learningSteps: settings.learningSteps.map(toStepUnit),
    relearningSteps: ["10m"] as StepUnit[],
    allowModelOverride: false,
    enableFuzz: true,
    maximumInterval: 36_500,
  };
}

function toStepUnit(step: string): StepUnit {
  const m = /^(\d+)([smhd])$/.exec(step);
  if (!m) throw new RangeError(`Not a learning step: ${step}`);
  return m[2] === "s" ? `${Math.max(1, Math.round(Number(m[1]) / 60))}m` : (step as StepUnit);
}

export type Scheduler = Awaited<ReturnType<typeof DefaultScheduler<"FSRS-7">>>;
/** A ts-fsrs card, dates as Date. */
export type FsrsCard = DefaultSchedulerCard<"FSRS-7">;

/** A ts-fsrs card as `cards.fsrs` keeps it: the same fields, dates as ISO strings. */
export type StoredFsrs = Omit<FsrsCard, "dueAt" | "lastReviewAt"> & { dueAt: string; lastReviewAt: string | null };

const schedulers = new Map<string, Promise<Scheduler>>();

/** One scheduler per set of settings, made once (ts-fsrs builds them asynchronously). */
export function schedulerFor(settings: FsrsSettings): Promise<Scheduler> {
  const key = JSON.stringify([settings.targetRecall, settings.learningSteps]);
  let scheduler = schedulers.get(key);
  if (!scheduler) {
    scheduler = DefaultScheduler(schedulerOptions(settings));
    scheduler.catch(() => schedulers.delete(key));
    schedulers.set(key, scheduler);
  }
  return scheduler;
}

export function toStored(card: FsrsCard): StoredFsrs {
  return { ...card, dueAt: card.dueAt.toISOString(), lastReviewAt: card.lastReviewAt?.toISOString() ?? null };
}

/** The card ts-fsrs works on: the stored one, or a new one for a card never graded. */
export function fromStored(scheduler: Scheduler, cardId: number, stored: StoredFsrs | null, now: Date): FsrsCard {
  if (!stored) return scheduler.newCard({ now, cardId: String(cardId) });
  return {
    ...stored,
    cardId: String(cardId),
    dueAt: new Date(stored.dueAt),
    lastReviewAt: stored.lastReviewAt ? new Date(stored.lastReviewAt) : null,
  };
}

/** The copies of the FSRS state kept as columns on `cards`, for the due queue and stats. */
export type CardColumns = {
  state: CardState;
  dueAt: Date;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  lastReviewAt: Date | null;
};

export function columnsOf(card: FsrsCard): CardColumns {
  return {
    state: CARD_STATES[card.state],
    dueAt: card.dueAt,
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    lastReviewAt: card.lastReviewAt,
  };
}

export type Graded = { card: FsrsCard; stored: StoredFsrs; columns: CardColumns; revlog: Record<string, unknown> };

/** Grades a card at `at`. Never changes the card it's given. */
export function gradeCard(
  scheduler: Scheduler,
  input: { cardId: number; fsrs: StoredFsrs | null; grade: Grade; at: Date },
): Graded {
  const before = fromStored(scheduler, input.cardId, input.fsrs, input.at);
  const { card, revlog } = scheduler.review({ card: before, grade: input.grade, now: input.at });
  return { card, stored: toStored(card), columns: columnsOf(card), revlog: serializeDates(revlog) };
}

/** Where each grade would send the card if it were graded at `now`. */
export function previewGrades(
  scheduler: Scheduler,
  input: { cardId: number; fsrs: StoredFsrs | null; now: Date },
): Record<Grade, FsrsCard> {
  const card = fromStored(scheduler, input.cardId, input.fsrs, input.now);
  const out = {} as Record<Grade, FsrsCard>;
  for (const item of scheduler.preview({ card, now: input.now })) {
    if (isGrade(item.grade)) out[item.grade] = item.card;
  }
  return out;
}

/** How likely the card is to be remembered at `now`, 0–1; 0 for a card never graded. */
export function retrievability(scheduler: Scheduler, cardId: number, stored: StoredFsrs | null, now: Date): number {
  if (!stored?.lastReviewAt) return 0;
  const card = fromStored(scheduler, cardId, stored, now);
  const elapsed = Math.max(0, scheduler.chrono.difference(card.lastReviewAt!, now));
  return scheduler.model.forgettingCurve(card, elapsed);
}

/** The button label for the wait until `due`: "1 min", "10 min", "5 h", "4 days", "3 months". */
export function formatInterval(from: Date, due: Date): string {
  const minutes = Math.max(0, (due.getTime() - from.getTime()) / 60_000);
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)} h`;
  const days = Math.round(hours / 24);
  if (days < 60) return days === 1 ? "1 day" : `${days} days`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  const years = Math.round((days / 365) * 10) / 10;
  return years === 1 ? "1 year" : `${years} years`;
}

function serializeDates(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]));
}
