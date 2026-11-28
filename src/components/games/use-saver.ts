"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { GameRun } from "@/lib/games/types";

import { claimable, enqueue, queuedRuns, setQueuedRuns } from "./queue";

/**
 * - `saved`: everything this player had is saved.
 * - `waiting`: runs are kept on the device until there's signal ("Try again").
 * - `nameless`: runs are kept until someone picks a name ("Save your score").
 */
export type SaveStatus = { state: "idle" | "saving" | "saved" | "waiting" | "nameless"; waiting: number };

/** The newest run's answer from the server, once it's saved. */
export type Saved = { id: string; score: number; ranked: boolean };

/**
 * Saves finished runs for the player (undefined while not known yet), keeping any that don't make
 * it and trying them again when the player is known, when the signal comes back, or on "Try again".
 * `onSaved` runs after any run saved, so the start screen can fetch the history again.
 */
export function useRunSaver(playerId: string | null | undefined, onSaved?: () => void) {
  const [status, setStatus] = useState<SaveStatus>(() => ({ state: "idle", waiting: queuedRuns().length }));
  const [last, setLast] = useState<Saved | null>(null);
  const busy = useRef(false);
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  });

  const flush = useCallback(async () => {
    if (busy.current || playerId === undefined) return;
    const all = queuedRuns();
    if (playerId === null) {
      setStatus({ state: all.some((q) => q.playerId === null) ? "nameless" : all.length ? "waiting" : "idle", waiting: all.length });
      return;
    }
    const mine = claimable(all, playerId);
    if (mine.length === 0) return;
    busy.current = true;
    setStatus({ state: "saving", waiting: mine.length });
    const done = new Set<string>();
    for (const { run } of mine) {
      try {
        const res = await fetch("/api/play/runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(run),
        });
        if (res.ok) {
          const body = (await res.json()) as { score: number; ranked: boolean };
          setLast({ id: run.id, score: body.score, ranked: body.ranked });
          done.add(run.id);
        } else if (res.status === 422 || res.status === 400) {
          // A run the server turns away won't save on a retry either; drop it.
          console.error("The run wasn't accepted", run.id, await res.text());
          done.add(run.id);
        }
      } catch {
        // No signal: it stays for next time.
      }
    }
    const left = queuedRuns().filter((q) => !done.has(q.run.id));
    setQueuedRuns(left);
    busy.current = false;
    if (done.size > 0) onSavedRef.current?.();
    const waiting = claimable(left, playerId).length;
    setStatus({ state: waiting ? "waiting" : "saved", waiting });
  }, [playerId]);

  const save = useCallback(
    async (run: GameRun) => {
      enqueue(run, playerId ?? null);
      await flush();
    },
    [playerId, flush],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- runs left from an earlier visit save on open
    void flush();
    const online = () => void flush();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [flush]);

  return { status, last, save, flush };
}
