/** Words for times and counts on the review screens. */
import { daysBetween, formatShort, studyDate } from "@/lib/day";

const TIME = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });

/** "at 6:40 pm", "tomorrow", "on Mon 7 Dec": when the next card is due, in India time. */
export function formatNextDue(at: Date, now: Date): string {
  const days = daysBetween(studyDate(now), studyDate(at));
  if (days <= 0) return `at ${TIME.format(at).replace(/\s?([ap])\.?m\.?$/i, " $1m").toLowerCase()}`;
  if (days === 1) return "tomorrow";
  return `on ${formatShort(studyDate(at), studyDate(now))}`;
}

/** The deck id in `?deck=`, or null. */
export function deckParam(value: string | string[] | undefined): number | null {
  const id = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
