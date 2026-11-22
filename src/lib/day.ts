/**
 * All study-day maths. Nothing else in the app does date arithmetic.
 *
 * - A study date is a plain "YYYY-MM-DD" string, the same form as a Postgres `date`.
 * - It is the date in India (IST, UTC+5:30, no daylight saving), with the day starting at
 *   4 am: studying at 1 am still counts for the evening before. So a study day runs from
 *   22:30 UTC the evening before to 22:30 UTC.
 * - Dates without a time (phases, exams, overrides) are compared as plain dates.
 */

export type StudyDate = string;

const DAY_MS = 24 * 60 * 60 * 1000;
/** IST is UTC+5:30 and the day starts at 4:00, so a study day starts 1:30 before UTC midnight. */
const SHIFT_MS = (5 * 60 + 30 - 4 * 60) * 60 * 1000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written as YYYY-MM-DD. */
export function isStudyDate(value: unknown): value is StudyDate {
  if (typeof value !== "string") return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

function toUtcMidnight(date: StudyDate): number {
  if (!isStudyDate(date)) throw new RangeError(`Not a date: ${date}`);
  return Date.parse(`${date}T00:00:00Z`);
}

function fromUtcMs(ms: number): StudyDate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The study date an instant belongs to. */
export function studyDate(at: Date = new Date()): StudyDate {
  return fromUtcMs(at.getTime() + SHIFT_MS);
}

/** When a study day starts (inclusive) and ends (exclusive), as instants. */
export function studyDayBounds(date: StudyDate): { start: Date; end: Date } {
  const start = toUtcMidnight(date) - SHIFT_MS;
  return { start: new Date(start), end: new Date(start + DAY_MS) };
}

export function addDays(date: StudyDate, days: number): StudyDate {
  return fromUtcMs(toUtcMidnight(date) + days * DAY_MS);
}

/** Whole days from `from` to `to`: 1 for tomorrow, 0 for the same day, negative for the past. */
export function daysBetween(from: StudyDate, to: StudyDate): number {
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / DAY_MS);
}

/** 0 is Sunday … 6 is Saturday, like Date.getDay(). */
export function weekday(date: StudyDate): number {
  return new Date(toUtcMidnight(date)).getUTCDay();
}

export function isWeekend(date: StudyDate): boolean {
  const day = weekday(date);
  return day === 0 || day === 6;
}

export function dayKind(date: StudyDate): "weekday" | "weekend" {
  return isWeekend(date) ? "weekend" : "weekday";
}

/** The Monday-to-Sunday week a date falls in (streaks and the weekly summary use it). */
export function weekOf(date: StudyDate): { start: StudyDate; end: StudyDate } {
  const fromMonday = (weekday(date) + 6) % 7;
  const start = addDays(date, -fromMonday);
  return { start, end: addDays(start, 6) };
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "Thursday 3 December", as page headers show it. */
export function formatLong(date: StudyDate): string {
  const d = new Date(toUtcMidnight(date));
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/**
 * "Thu 31 Dec". The year is added for a date more than about six months from `today`
 * ("Sun 4 Jul 2027"), where it could be read as the wrong one.
 */
export function formatShort(date: StudyDate, today?: StudyDate): string {
  const d = new Date(toUtcMidnight(date));
  const base = `${WEEKDAYS[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
  return today === undefined || Math.abs(daysBetween(today, date)) <= 180 ? base : `${base} ${d.getUTCFullYear()}`;
}

/** "1 Jan", for small badges. */
export function formatDayMonth(date: StudyDate): string {
  const d = new Date(toUtcMidnight(date));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
}

// ---------------------------------------------------------------------------
// Phases

export const PHASE_IDS = ["n5", "n4", "n3", "work"] as const;
export type PhaseId = (typeof PHASE_IDS)[number];

export const PHASE_NAMES: Record<PhaseId, string> = {
  n5: "N5 refresh",
  n4: "N4 build",
  n3: "N3 build",
  work: "Work Japanese",
};

/** The part of the settings phaseFor needs: when each phase starts. */
export type PhaseStarts = { phases: Record<PhaseId, { start: StudyDate }> };

export type Phase = {
  id: PhaseId;
  start: StudyDate;
  /** The day before the next phase starts; null for the last phase, which doesn't end. */
  end: StudyDate | null;
};

/**
 * The phase a date falls in. Each phase runs until the next one starts, so there are no gaps:
 * an exam day belongs to the phase that ends with it. null before the first phase starts.
 */
export function phaseFor(date: StudyDate, settings: PhaseStarts): Phase | null {
  const phases = PHASE_IDS.map((id) => ({ id, start: settings.phases[id].start })).sort((a, b) =>
    daysBetween(b.start, a.start),
  );
  for (let i = phases.length - 1; i >= 0; i--) {
    if (daysBetween(phases[i].start, date) >= 0) {
      const next = phases[i + 1];
      return { ...phases[i], end: next ? addDays(next.start, -1) : null };
    }
  }
  return null;
}
