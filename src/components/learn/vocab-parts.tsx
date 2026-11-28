"use client";

import { useSyncExternalStore } from "react";

import { Banner } from "@/components/ui/banner";
import { getVocabQueue } from "@/lib/vocab/queue";
import type { Direction } from "@/lib/vocab/types";

export const DIRECTION_LABELS: Record<Direction, string> = { ja_en: "Japanese → English", en_ja: "English → Japanese" };

/** "2 answers waiting to save", once answers are held up (no signal, or the server didn't take them). */
export function WaitingLine() {
  const queue = getVocabQueue();
  const state = useSyncExternalStore(queue.subscribe, queue.getState, queue.getState);
  if (state.waiting === 0 || !state.stuck) return null;
  return (
    <div role="status">
      <Banner kind="waiting" title={`${state.waiting} ${state.waiting === 1 ? "answer" : "answers"} waiting to save`}>
        {state.offline ? "Retrying when you're back online." : "They save by themselves; keep going."}
      </Banner>
    </div>
  );
}
