/**
 * Where the quick check puts the items you already know (decision 6): long first intervals,
 * spread over 4 weeks with at most 30 due on any day, so they don't all come back at once.
 */
import { addDays, type StudyDate } from "@/lib/day";

/** At most this many quick-check items come due on one day. */
export const KNOWN_PER_DAY = 30;
/** The first known items come back this many days after the check… */
export const KNOWN_FIRST_DAY = 2;
/** …and the spread runs to this many days after it. */
export const KNOWN_LAST_DAY = 28;

/**
 * The day to put the next known item on: the least-loaded day in the spread (the earliest of
 * equals), and once every day there is full, the first day after it with room. `loads` counts the
 * items already put on each day; the caller adds one for the day returned.
 */
export function pickSpreadDay(checkedOn: StudyDate, loads: ReadonlyMap<StudyDate, number>): StudyDate {
  let best: StudyDate | null = null;
  let bestLoad = Infinity;
  for (let offset = KNOWN_FIRST_DAY; offset <= KNOWN_LAST_DAY; offset++) {
    const day = addDays(checkedOn, offset);
    const load = loads.get(day) ?? 0;
    if (load < KNOWN_PER_DAY && load < bestLoad) {
      best = day;
      bestLoad = load;
    }
  }
  if (best) return best;
  let day = addDays(checkedOn, KNOWN_LAST_DAY + 1);
  while ((loads.get(day) ?? 0) >= KNOWN_PER_DAY) day = addDays(day, 1);
  return day;
}
