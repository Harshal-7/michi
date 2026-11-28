"use client";
// design-lint: legacy

import { useSyncExternalStore } from "react";

import { getVocabQueue } from "@/lib/vocab/queue";
import type { Direction } from "@/lib/vocab/types";

export const DIRECTION_LABELS: Record<Direction, string> = { ja_en: "Japanese → English", en_ja: "English → Japanese" };

/** "2 answers waiting to save", once answers are held up (no signal, or the server didn't take them). */
export function WaitingLine() {
  const queue = getVocabQueue();
  const state = useSyncExternalStore(queue.subscribe, queue.getState, queue.getState);
  if (state.waiting === 0 || !state.stuck) return null;
  return (
    <p role="status" className="m-0 self-start rounded-full border border-warn bg-surface px-3 py-1.5 text-[12.5px] font-bold text-warn">
      {state.waiting} {state.waiting === 1 ? "answer" : "answers"} waiting to save{state.offline ? " · retrying" : ""}
    </p>
  );
}
