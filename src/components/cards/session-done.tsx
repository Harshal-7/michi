"use client";

import Link from "next/link";

import { type OutboxState, useOutbox } from "@/lib/srs/outbox";
import { GRADE_NAMES, type Grade, GRADES } from "@/lib/srs/scheduler";
import type { StudyCard, UpNext } from "@/lib/srs/types";

import { NoSignal, SaveState } from "./status";


const COLOR: Record<Grade, string> = { 1: "text-again", 2: "text-ink", 3: "text-good", 4: "text-easy" };
const CARD = "rounded-card bg-surface shadow-card";

/** The end of a session (F_ReviewDone). */
export function SessionDone(props: {
  mode: "review" | "new";
  scope: string;
  first: Record<number, Grade>;
  /** Grades made, counting a card's repeats. */
  graded: number;
  startedAt: number;
  endedAt: number;
  waiting: StudyCard[];
  trouble: string[];
  upNext: UpNext | null;
  outbox: OutboxState;
}) {
  const grades = Object.values(props.first);
  const cards = grades.length;
  const counts = Object.fromEntries(GRADES.map((g) => [g, grades.filter((x) => x === g).length])) as Record<Grade, number>;
  const recalled = cards ? Math.round(((cards - counts[1]) / cards) * 100) : 0;
  const minutes = Math.max(1, Math.round((props.endedAt - props.startedAt) / 60_000));
  const soonest = props.waiting.reduce((min, c) => Math.min(min, c.dueAt ? Date.parse(c.dueAt) : min), Infinity);
  const backIn = Number.isFinite(soonest) ? Math.max(1, Math.ceil((soonest - props.endedAt) / 60_000)) : null;
  const offline = props.outbox.offline;

  return (
    <>
      <header className="flex flex-col gap-0.5">
        <p className="m-0 text-[13px] text-ink2">{props.scope}</p>
        <h1 className="m-0 font-head text-[30px] leading-[1.15]">{cards ? "Session done" : "Session ended"}</h1>
      </header>

      <section className={`${CARD} flex flex-col gap-3 p-4`}>
        {cards ? (
          <>
            <div className="flex flex-wrap items-baseline gap-2.5">
              <p className="m-0 font-head text-[40px] leading-none">{cards}</p>
              <p className="m-0 text-[15px] text-ink2">
                {cards === 1 ? "card" : "cards"} in {minutes} min · {recalled}% recalled
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {GRADES.map((g) => (
                <div key={g} className="flex flex-col items-center gap-0.5 rounded-[14px] bg-surface2 px-1.5 py-2.5">
                  <span className="text-xl font-bold">{counts[g]}</span>
                  <span className={`text-[12.5px] font-bold ${COLOR[g]}`}>{GRADE_NAMES[g]}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="m-0 text-[15px] text-ink2">Nothing was graded this time.</p>
        )}
        {props.graded > 0 && <SaveState state={props.outbox} total={props.graded} saving />}
      </section>

      {(props.waiting.length > 0 || props.trouble.length > 0) && (
        <section className={`${CARD} flex flex-col gap-1.5 px-3.5 py-3`}>
          <h2 className="m-0 text-[13px] font-bold">Coming back soon</h2>
          {props.waiting.length > 0 && backIn !== null && (
            <p className="m-0 text-sm">
              The {props.waiting.length === 1 ? "card" : `${props.waiting.length} cards`}{" "}
              {props.mode === "new" ? "you're learning" : "you missed"} come{props.waiting.length === 1 ? "s" : ""} back in
              about {backIn} {backIn === 1 ? "minute" : "minutes"}, and Today shows {props.waiting.length === 1 ? "it" : "them"}.
            </p>
          )}
          {props.trouble.map((term) => (
            <p key={term} className="m-0 text-sm">
              <span lang="ja" className="font-card font-semibold">
                {term}
              </span>{" "}
              was missed again, so it is now a trouble card.
            </p>
          ))}
        </section>
      )}

      {offline && <NoSignal />}

      {props.upNext && <UpNextCard upNext={props.upNext} offline={offline} />}

      <Link href="/" className="inline-flex min-h-11 items-center self-center text-sm font-semibold text-ink2">
        Back to Today
      </Link>
    </>
  );
}

/** The one "next up" card on a screen, with its Start button (F_ReviewDone). */
export function UpNextCard({ upNext, offline }: { upNext: UpNext; offline: boolean }) {
  return (
    <section className="flex items-center gap-3 rounded-card bg-surface p-4 shadow-hero">
      <div className="flex flex-auto flex-col gap-0.5">
        <p className="m-0 text-[12.5px] font-bold text-accent">Up next</p>
        <h2 className="m-0 text-[17px] font-bold">{upNext.title}</h2>
        <p className="m-0 text-[13px] text-ink2">{upNext.detail}</p>
      </div>
      {offline ? (
        <span
          aria-disabled="true"
          className="inline-flex min-h-11 items-center rounded-btn bg-accent px-5 text-[15px] font-bold text-on-accent opacity-50"
        >
          Start
        </span>
      ) : (
        <Link
          href={upNext.href}
          className="inline-flex min-h-11 items-center rounded-btn bg-accent px-5 text-[15px] font-bold text-on-accent no-underline"
        >
          Start
        </Link>
      )}
    </section>
  );
}

/** The Up next card outside a session, greyed out with no signal. */
export function UpNextLive({ upNext }: { upNext: UpNext }) {
  const { offline } = useOutbox();
  return (
    <>
      <UpNextCard upNext={upNext} offline={offline} />
      {offline && <NoSignal />}
    </>
  );
}
