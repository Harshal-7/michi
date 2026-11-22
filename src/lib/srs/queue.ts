/**
 * The review queue's order (the plan's "Reviews on a patchy phone connection", step 1):
 * learning cards first, then class and current-level cards, then the rest. During a backlog the
 * cards most likely to still be remembered come first, so they aren't lost too.
 */
import { type PhaseId } from "@/lib/day";

import type { CardState } from "./scheduler";

/** Learning cards due within this long are part of a session that opens now. */
export const LEARNING_AHEAD_MS = 20 * 60_000;

export type QueueEntry = {
  id: number;
  state: CardState;
  /** ISO instant. */
  dueAt: string | null;
  level: "N5" | "N4" | "N3" | null;
  /** Added from a class log. */
  fromClass: boolean;
  /** How likely it is to be remembered now, 0–1. */
  recall: number;
};

/** The JLPT level a phase studies; Work Japanese has none. */
export function levelForPhase(phase: PhaseId | null): "N5" | "N4" | "N3" | null {
  return phase === "n5" ? "N5" : phase === "n4" ? "N4" : phase === "n3" ? "N3" : null;
}

/**
 * A backlog: more review cards due than 1.5 normal days' worth (the planner's recovery rule),
 * where a normal day is the recent daily average, and never fewer than 50 cards.
 */
export function isBacklog(dueReviews: number, recentDailyAverage: number): boolean {
  return dueReviews > Math.max(50, 1.5 * recentDailyAverage);
}

function group(entry: QueueEntry, currentLevel: QueueEntry["level"]): number {
  if (entry.state === "learning" || entry.state === "relearning") return 0;
  if (entry.fromClass || (currentLevel !== null && entry.level === currentLevel)) return 1;
  return 2;
}

const dueMs = (e: QueueEntry) => (e.dueAt ? Date.parse(e.dueAt) : 0);

export function orderQueue<T extends QueueEntry>(
  entries: T[],
  options: { currentLevel: QueueEntry["level"]; backlog: boolean },
): T[] {
  return [...entries].sort((a, b) => {
    const ga = group(a, options.currentLevel);
    const gb = group(b, options.currentLevel);
    if (ga !== gb) return ga - gb;
    if (ga > 0 && options.backlog && a.recall !== b.recall) return b.recall - a.recall;
    return dueMs(a) - dueMs(b) || a.id - b.id;
  });
}
