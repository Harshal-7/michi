"use client";

import { useOptimistic, useState, useTransition } from "react";

import { saveDeckPace, suspendCard } from "@/app/(app)/decks/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { SectionTitle } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import type { DeckCard } from "@/lib/srs/decks";

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
    <Card aria-labelledby="pace" className="flex flex-col gap-3">
      <SectionTitle id="pace">Pace</SectionTitle>
      <Segmented
        label="Pace"
        name="pace"
        value={choice}
        onChange={setChoice}
        options={[
          { value: "deadline", label: "By the deadline" },
          { value: "per_day", label: "A number a day" },
        ]}
      />
      {choice === "deadline" ? (
        <p className="m-0 text-body text-ink2">
          New cards are spread over the study days left{deadline ? ` before ${deadline}` : ""}, so the list finishes on time.
        </p>
      ) : (
        <Field
          label="New cards a day"
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          className="max-w-40"
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={pending} loading={pending}>
          {pending ? "Saving…" : "Save the pace"}
        </Button>
        {message && (
          <p role="status" className="m-0 text-meta text-ink2">
            {message}
          </p>
        )}
      </div>
    </Card>
  );
}

function chip(card: DeckCard) {
  if (card.suspended) return <Chip cover="pink">Suspended</Chip>;
  if (card.state === "new") return <Chip kind="soon">Not started</Chip>;
  if (card.state === "review" && (card.intervalDays ?? 0) >= KNOWN_DAYS) return <Chip cover="mint">Known</Chip>;
  return <Chip cover="blue">Learning</Chip>;
}

/** Every card in the list, with a way to suspend it (it stops coming up) or bring it back. Two columns on a wide screen. */
export function DeckCards({ cards }: { cards: DeckCard[] }) {
  const [shown, setShown] = useOptimistic(cards, (state, change: { cardId: number; suspended: boolean }) =>
    state.map((c) => (c.cardId === change.cardId ? { ...c, suspended: change.suspended } : c)),
  );
  const [, start] = useTransition();
  return (
    <ul aria-label="Cards" className="m-0 grid list-none grid-cols-1 p-0 wide:grid-cols-2 wide:gap-x-8">
      {shown.map((card) => (
        <li key={card.cardId} className="flex min-h-15 min-w-0 items-center gap-2.5 border-b-[1.5px] border-line py-1.5">
          <span className="flex min-w-0 flex-auto flex-col">
            <span className={`flex items-baseline gap-2 ${card.suspended ? "text-ink2" : "text-ink"}`}>
              <span lang="ja" className="font-ja text-title font-semibold">
                {card.term}
              </span>
              {card.cardType === "production" && <span className="text-caption text-ink2">meaning first</span>}
            </span>
            <span className="truncate text-meta text-ink2">
              {card.kind === "word" && card.reading ? (
                <>
                  <span lang="ja">{card.reading}</span> ·{" "}
                </>
              ) : null}
              {card.kind === "kana" ? card.reading : card.meaning}
            </span>
          </span>
          {chip(card)}
          <Button
            variant="text"
            size="sm"
            className="px-2"
            onClick={() =>
              start(async () => {
                setShown({ cardId: card.cardId, suspended: !card.suspended });
                await suspendCard(card.cardId, !card.suspended);
              })
            }
          >
            {card.suspended ? "Bring back" : "Suspend"}
          </Button>
        </li>
      ))}
    </ul>
  );
}
