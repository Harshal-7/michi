/**
 * The streak (decision 13): a day counts when its streak tasks are done (Reviews until the daily
 * quiz exists). One missed day in each Monday-to-Sunday week is forgiven: it neither breaks the
 * streak nor adds to it. Today doesn't count against you until it's over. The best streak is kept.
 * Nothing before the first planned day counts as missed.
 */
import { addDays, daysBetween, type StudyDate, weekOf } from "@/lib/day";

export type Streak = {
  current: number;
  best: number;
  /** Days counted this week so far. */
  thisWeek: number;
  /** This week's one forgiven day has been used. */
  forgivenThisWeek: boolean;
};

/**
 * The streak ending at `end`: counted days walking back from it, forgiving one miss per week and
 * stopping at a second. `end` itself only counts if it's counted; if it isn't, it's skipped
 * (today, still in progress).
 */
function runEndingAt(counted: ReadonlySet<StudyDate>, first: StudyDate, end: StudyDate): number {
  let length = counted.has(end) ? 1 : 0;
  const forgiven = new Set<StudyDate>();
  for (let d = addDays(end, -1); daysBetween(first, d) >= 0; d = addDays(d, -1)) {
    if (counted.has(d)) {
      length++;
      continue;
    }
    const week = weekOf(d).start;
    if (forgiven.has(week)) break;
    forgiven.add(week);
  }
  return length;
}

export function streakOf(counted: ReadonlySet<StudyDate>, first: StudyDate | null, today: StudyDate): Streak {
  if (!first || daysBetween(first, today) < 0) return { current: 0, best: 0, thisWeek: 0, forgivenThisWeek: false };
  const current = runEndingAt(counted, first, today);
  let best = current;
  // A run ending the day before a counted day is one shorter than the run ending on it, so only
  // the last day of each stretch can be a best.
  for (const day of counted) {
    const stretchEnd = !counted.has(addDays(day, 1));
    if (stretchEnd && daysBetween(first, day) >= 0 && daysBetween(day, today) > 0) {
      best = Math.max(best, runEndingAt(counted, first, day));
    }
  }
  const weekStart = weekOf(today).start;
  let thisWeek = 0;
  let forgivenThisWeek = false;
  for (let d = weekStart; daysBetween(d, today) >= 0; d = addDays(d, 1)) {
    if (counted.has(d)) thisWeek++;
    else if (daysBetween(d, today) > 0 && daysBetween(first, d) >= 0) forgivenThisWeek = true;
  }
  return { current, best, thisWeek, forgivenThisWeek };
}
