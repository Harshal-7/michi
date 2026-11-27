/**
 * Minutes an in-app speaking or shadowing session logs by itself: from the first Record or Play to
 * Done, at least 1 and at most 30, so a tab left open doesn't log an evening.
 */
export const MAX_SESSION_MINUTES = 30;

/** Any number of minutes, held to 1–30 whole minutes. */
export function capMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 1;
  return Math.min(MAX_SESSION_MINUTES, Math.max(1, Math.round(minutes)));
}

/** Whole minutes from `startedAt` to `endedAt` (epoch ms), rounded, capped at 30, at least 1. */
export function sessionMinutes(startedAt: number, endedAt: number): number {
  return capMinutes((endedAt - startedAt) / 60_000);
}
