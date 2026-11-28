"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";

import { switchDeck } from "@/app/(app)/decks/actions";
import { Icon } from "@/components/ui/icon";
import { Switch } from "@/components/ui/switch";

export type DeckRowView = { id: number; name: string; on: boolean; meta: string };

const ROW = "flex min-h-16 items-center gap-3 border-b-[1.5px] border-line py-1.5";

/** The decks: each with its switch; the name opens the deck. Two columns on a laptop. */
export function DeckList({ rows, workLockedUntil }: { rows: DeckRowView[]; workLockedUntil: string | null }) {
  const [optimistic, setOptimistic] = useOptimistic(rows, (state, change: { id: number; on: boolean }) =>
    state.map((r) => (r.id === change.id ? { ...r, on: change.on } : r)),
  );
  const [, start] = useTransition();
  return (
    <ul className="m-0 grid list-none grid-cols-1 p-0 laptop:grid-cols-2 laptop:gap-x-10">
      {optimistic.map((deck) => (
        <li key={deck.id} className={ROW}>
          <Link
            href={`/decks/${deck.id}`}
            className="-ml-2.5 flex min-h-13 min-w-0 flex-auto items-center gap-2 rounded-btn pl-2.5 text-ink no-underline transition-colors duration-120 hover:bg-surface2"
          >
            <span className="flex min-w-0 flex-auto flex-col">
              <span className={`text-body font-bold ${deck.on ? "text-ink" : "text-ink2"}`}>{deck.name}</span>
              <span className="text-meta text-ink2">{deck.meta}</span>
            </span>
            <Icon name="chevron-right" size={20} className="text-ink3" />
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
        </li>
      ))}
      {workLockedUntil && (
        <li className={ROW} aria-disabled="true">
          <span className="flex min-w-0 flex-auto flex-col">
            <span className="text-body font-bold text-ink3">Work Japanese</span>
            <span className="text-meta text-ink3">locked until {workLockedUntil}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-meta font-bold text-ink3">
            <Icon name="lock" size={18} />
            Locked
          </span>
        </li>
      )}
    </ul>
  );
}
