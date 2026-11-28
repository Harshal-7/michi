"use client";
// design-lint: legacy

import { useOptimistic, useState, useTransition } from "react";

import { saveDeckPace, suspendCard } from "@/app/(app)/decks/actions";
import type { DeckCard } from "@/lib/srs/decks";

const CHIP = "rounded-full px-2.5 py-1 text-[11.5px] font-bold whitespace-nowrap";
const KNOWN_DAYS = 14;

/** The pace of one list: spread over the days to its deadline, or a fixed number a day. */
export function PaceForm({
  deckId,
  mode,
  perDay,
  deadline,
}: {
  deckId: number;
  mode: "deadline" | "per_day";
  perDay: number | null;
  deadline: string | null;
}) {
  const [choice, setChoice] = useState(mode);
  const [count, setCount] = useState(String(perDay ?? 10));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const result = await saveDeckPace(deckId, choice === "deadline" ? { mode: "deadline" } : { mode: "per_day", perDay: Number(count) });
      setMessage("error" in result ? result.error : "Saved.");
    });
  return (
    <section className="flex flex-col gap-2.5 rounded-card bg-surface p-3.5 shadow-card">
      <h2 className="m-0 text-xs font-bold tracking-[0.04em] text-ink2 uppercase">Pace</h2>
      <div role="radiogroup" aria-label="Pace" className="flex flex-wrap gap-1.5">
        {(
          [
            ["deadline", "By the deadline"],
            ["per_day", "A fixed number a day"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={choice === value}
            onClick={() => setChoice(value)}
            className={`min-h-11 rounded-btn px-4 text-[13px] ${choice === value ? "bg-ink font-bold text-page" : "border border-line"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {choice === "deadline" ? (
        <p className="m-0 text-[13px] text-ink2">
          New cards are spread over the study days left{deadline ? ` before ${deadline}` : ""}, so the list finishes on time.
        </p>
      ) : (
        <label className="flex items-center gap-2.5 text-[13.5px] font-semibold">
          New cards a day
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="box-border min-h-11 w-20 rounded-xl border-2 border-line bg-page px-3 text-[15px] outline-none focus:border-accent"
          />
        </label>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="min-h-11 rounded-btn bg-accent px-[18px] text-sm font-bold text-on-accent disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save the pace"}
        </button>
        {message && (
          <p role="status" className="m-0 text-[13px] text-ink2">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}

function chip(card: DeckCard) {
  if (card.suspended) return <span className={`${CHIP} border border-line text-ink2`}>Suspended</span>;
  if (card.state === "new") return <span className={`${CHIP} bg-surface2 text-ink2`}>Not started</span>;
  if (card.state === "review" && (card.intervalDays ?? 0) >= KNOWN_DAYS)
    return <span className={`${CHIP} border border-good text-good`}>Known</span>;
  return <span className={`${CHIP} bg-accent-soft`}>Learning</span>;
}

/** Every card in the list, with a way to suspend it (it stops coming up) or bring it back. Two columns on a wide screen. */
export function DeckCards({ cards }: { cards: DeckCard[] }) {
  const [shown, setShown] = useOptimistic(cards, (state, change: { cardId: number; suspended: boolean }) =>
    state.map((c) => (c.cardId === change.cardId ? { ...c, suspended: change.suspended } : c)),
  );
  const [, start] = useTransition();
  return (
    <section className="flex flex-col rounded-card bg-surface px-3.5 py-1 shadow-card wide:grid wide:grid-cols-2 wide:gap-x-8 wide:px-5 wide:py-2">
      {shown.map((card, i) => (
        <div
          key={card.cardId}
          className={`flex min-h-[52px] min-w-0 items-center gap-3 py-1.5 ${i ? "border-t border-line" : ""} ${i === 1 ? "wide:border-t-0" : ""}`}
        >
          <span className="flex min-w-0 flex-auto flex-col">
            <span lang="ja" className={`font-card text-lg font-semibold ${card.suspended ? "text-ink2" : ""}`}>
              {card.term}
              {card.cardType === "production" && <span className="ml-2 font-sans text-xs font-normal text-ink2">meaning first</span>}
            </span>
            <span className="truncate text-xs text-ink2">
              {card.kind === "word" && card.reading ? (
                <>
                  <span lang="ja">{card.reading}</span> ·{" "}
                </>
              ) : null}
              {card.kind === "kana" ? card.reading : card.meaning}
            </span>
          </span>
          {chip(card)}
          <button
            type="button"
            onClick={() =>
              start(async () => {
                setShown({ cardId: card.cardId, suspended: !card.suspended });
                await suspendCard(card.cardId, !card.suspended);
              })
            }
            className="min-h-11 shrink-0 rounded-btn px-2 text-[13px] font-semibold text-ink2"
          >
            {card.suspended ? "Bring back" : "Suspend"}
          </button>
        </div>
      ))}
    </section>
  );
}
