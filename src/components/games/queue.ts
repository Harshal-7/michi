/**
 * Finished runs kept on this device until they save: no signal, the save failed, or nobody is
 * playing under a name yet ("Save your score" claims those). One queue for every game, in
 * localStorage; storage can be missing or full, and the games work without it.
 */
import type { GameRun } from "@/lib/games/types";

const KEY = "michi:play:runs";
/** Runs kept at most; the oldest go first. */
export const KEEP = 20;

/** A run and who played it: a player's id, or null when nobody had a name (or it wasn't known yet). */
export type QueuedRun = { run: GameRun; playerId: string | null };

export function queuedRuns(): QueuedRun[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as QueuedRun[]).filter((q) => q && typeof q === "object" && q.run?.id) : [];
  } catch {
    return [];
  }
}

export function setQueuedRuns(list: QueuedRun[]): void {
  try {
    if (list.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(list.slice(-KEEP)));
  } catch {
    // Private window or full storage: nothing is kept, and that's fine.
  }
}

export function enqueue(run: GameRun, playerId: string | null): void {
  setQueuedRuns([...queuedRuns().filter((q) => q.run.id !== run.id), { run, playerId }]);
}

/** The runs this player may save now: their own, and any played without a name. */
export const claimable = (list: QueuedRun[], playerId: string) => list.filter((q) => q.playerId === playerId || q.playerId === null);
