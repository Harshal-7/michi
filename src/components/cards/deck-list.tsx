"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";

import { Icon } from "@/components/ui/icon";
import { switchDeck } from "@/app/(app)/decks/actions";

import { Switch } from "./switch";

const LOCK = "M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3";
const CHEVRON = "M9 6l6 6-6 6";

export type DeckRowView = { id: number; name: string; on: boolean; meta: string };

/** The list on F_Decks: each deck with its switch; the name opens the deck. Two columns on a laptop. */
export function DeckList({ rows, workLockedUntil }: { rows: DeckRowView[]; workLockedUntil: string | null }) {
  const [optimistic, setOptimistic] = useOptimistic(rows, (state, change: { id: number; on: boolean }) =>
    state.map((r) => (r.id === change.id ? { ...r, on: change.on } : r)),
  );
  const [, start] = useTransition();
  return (
    <section className="flex flex-col rounded-card bg-surface px-3.5 py-1 shadow-card laptop:grid laptop:grid-cols-2 laptop:gap-x-8 laptop:px-5 laptop:py-2 wide:gap-x-10 wide:px-6">
      {optimistic.map((deck, i) => (
        <div
          key={deck.id}
          className={`box-border flex min-h-[50px] items-center gap-3 py-[5px] laptop:min-h-[60px] ${i ? "border-t border-line" : ""} ${i === 1 ? "laptop:border-t-0" : ""}`}
        >
          <Link href={`/decks/${deck.id}`} className="flex min-h-11 min-w-0 flex-auto items-center gap-2 no-underline">
            <span className="flex min-w-0 flex-auto flex-col gap-px">
              <span className={`text-[14.5px] font-semibold ${deck.on ? "text-ink" : "text-ink2"}`}>{deck.name}</span>
              <span className="text-xs text-ink2">{deck.meta}</span>
            </span>
            <Icon d={CHEVRON} size={16} stroke={1.8} className="shrink-0 text-ink2" />
          </Link>
          <Switch
            checked={deck.on}
            label={`${deck.name} on`}
            onChange={(on) =>
              start(async () => {
                setOptimistic({ id: deck.id, on });
                await switchDeck(deck.id, on);
              })
            }
          />
        </div>
      ))}
      {workLockedUntil && (
        <div className="box-border flex min-h-[50px] items-center gap-3 border-t border-line py-[5px]">
          <span className="flex min-w-0 flex-auto flex-col gap-px">
            <span className="text-[14.5px] font-semibold text-ink2">Work Japanese</span>
            <span className="text-xs text-ink2">locked until {workLockedUntil}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-ink2">
            <Icon d={LOCK} size={16} stroke={1.8} />
            Locked
          </span>
        </div>
      )}
    </section>
  );
}
