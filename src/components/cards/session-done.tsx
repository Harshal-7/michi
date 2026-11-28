"use client";

import type { ReactNode } from "react";

import { Rabbit } from "@/components/ui/art/rabbit";
import { Tick } from "@/components/ui/art/rewards";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { CoverCheck } from "@/components/ui/list-row";
import { SectionTitle } from "@/components/ui/page-header";
import { type OutboxState, useOutbox } from "@/lib/srs/outbox";
import { GRADE_NAMES, type Grade, GRADES } from "@/lib/srs/scheduler";
import type { StudyCard, UpNext } from "@/lib/srs/types";

import { NoSignal, SaveState } from "./status";

const FILL: Record<Grade, string> = { 1: "bg-again-soft", 2: "bg-warn-soft", 3: "bg-good-soft", 4: "bg-easy-soft" };

/**
 * The page a finished session sits on: full screen on the phone (over the bars, like the session
 * itself), the centred column on a laptop.
 */
export function DoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-session overflow-y-auto bg-page px-5 pt-[max(12px,env(safe-area-inset-top))] pb-8 laptop:static laptop:z-auto laptop:mx-auto laptop:w-full laptop:max-w-160 laptop:overflow-visible laptop:bg-transparent laptop:p-0">
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

/** The close button alone at the top of a finished session; it marks the page a session, so the bar stays hidden. */
export function DoneTop({ label }: { label: string }) {
  return (
    <header data-session="" className="-mx-2.5 flex min-h-12 items-center laptop:mx-0">
      <IconButton icon="close" label={label} href="/" />
    </header>
  );
}

/** The cheering rabbit, the title with the red tick, and the calm line under it (RF_ReviewDone). */
export function DoneHead({ title, tick = true, children }: { title: ReactNode; tick?: boolean; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center pt-3.5 text-center">
      <Rabbit pose="cheering" size={180} />
      <div className="mt-2.5 flex items-center gap-1.5">
        <h1 className="m-0 text-headline font-black">{title}</h1>
        {tick && (
          <span className="-mt-3.5">
            <Tick size={34} />
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/** A calm note on surface2 with an icon (RF_ReviewDone's "come back in about 8 minutes"). */
export function Note({ icon = "clock", children }: { icon?: "clock" | "info" | "alert"; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-btn bg-surface2 px-3.5 py-3 text-meta">
      <Icon name={icon} size={20} className="mt-px text-ink2" />
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

/** The end of a session (RF_ReviewDone): what you remembered, what comes back soon, and the next step. */
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
  const remembered = cards - counts[1];
  const recalled = cards ? Math.round((remembered / cards) * 100) : 0;
  const minutes = Math.max(1, Math.round((props.endedAt - props.startedAt) / 60_000));
  const soonest = props.waiting.reduce((min, c) => Math.min(min, c.dueAt ? Date.parse(c.dueAt) : min), Infinity);
  const backIn = Number.isFinite(soonest) ? Math.max(1, Math.ceil((soonest - props.endedAt) / 60_000)) : null;
  const offline = props.outbox.offline;
  const name = props.mode === "new" ? "New items" : "Reviews";

  return (
    <DoneShell>
      <DoneTop label={`Close ${name.toLowerCase()}`} />
      <DoneHead title={cards ? `${name} done` : "Session ended"} tick={cards > 0}>
        <p className="m-0 mt-0.5 text-body text-ink2">
          {cards ? `${cards} ${cards === 1 ? "card" : "cards"} in ${minutes} min` : "Nothing was graded this time."}
          <span className="sr-only"> · {props.scope}</span>
        </p>
        {props.graded > 0 && (
          <div className="mt-1">
            <SaveState state={props.outbox} total={props.graded} saving />
          </div>
        )}
      </DoneHead>

      {cards > 0 && (
        <section aria-label="How it went" className="mt-6.5 border-t-[1.5px] border-line pt-5 pb-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="m-0 flex items-baseline gap-2.5">
              <span className="text-display leading-none font-black">{remembered}</span>
              <span className="text-body text-ink2">of {cards} remembered</span>
            </p>
            <span className="text-body font-black text-good">{recalled}%</span>
          </div>
          <div role="img" aria-label={GRADES.map((g) => `${GRADE_NAMES[g]} ${counts[g]}`).join(", ")} className="mt-3.5 flex gap-0.75">
            {GRADES.filter((g) => counts[g] > 0).map((g) => (
              <span key={g} className={`h-3.5 rounded-box ${FILL[g]}`} style={{ flex: counts[g] }} />
            ))}
          </div>
          <ul className="m-0 mt-2.5 flex list-none justify-between p-0">
            {GRADES.map((g) => (
              <li key={g} className="flex items-center gap-1.5 text-meta">
                <span aria-hidden="true" className={`size-3 rounded-box ${FILL[g]}`} />
                <span className="text-ink2">{GRADE_NAMES[g]}</span>
                <b className="font-black">{counts[g]}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(props.waiting.length > 0 || props.trouble.length > 0) && (
        <div className="mt-4">
          <Note>
            {props.waiting.length > 0 && backIn !== null && (
              <p className="m-0">
                The {props.waiting.length === 1 ? "card" : `${props.waiting.length} cards`} {props.mode === "new" ? "you’re learning" : "you missed"} come
                {props.waiting.length === 1 ? "s" : ""} back in about {backIn} {backIn === 1 ? "minute" : "minutes"}, and Today shows{" "}
                {props.waiting.length === 1 ? "it" : "them"}.
              </p>
            )}
            {props.trouble.map((term) => (
              <p key={term} className="m-0">
                <span lang="ja" className="font-ja">
                  {term}
                </span>{" "}
                was missed again, so it’s now a trouble card.
              </p>
            ))}
          </Note>
        </div>
      )}

      {offline && (
        <div className="mt-4">
          <NoSignal />
        </div>
      )}

      {props.upNext && (
        <div className="mt-6">
          <UpNextCard upNext={props.upNext} offline={offline} />
        </div>
      )}

      <div className="mt-2 flex justify-center">
        <Button variant="quiet" href="/">
          Back to Today
        </Button>
      </div>
    </DoneShell>
  );
}

/** The one "Up next" card on a screen, with its Start button (RF_ReviewDone). */
export function UpNextCard({ upNext, offline }: { upNext: UpNext; offline: boolean }) {
  return (
    <section aria-labelledby="up-next-title">
      <SectionTitle id="up-next-title">Up next</SectionTitle>
      <Card aria-label={`Up next: ${upNext.title}`} className="mt-1 flex flex-col gap-3.5">
        <div className="flex items-center gap-3">
          <CoverCheck cover="mint" state="todo" />
          <div className="min-w-0 flex-1">
            <h3 className="m-0 text-lead font-black">{upNext.title}</h3>
            <p className="m-0 text-meta text-ink2">{upNext.detail}</p>
          </div>
        </div>
        {offline ? (
          <Button size="lg" icon="play" full disabled>
            Start
          </Button>
        ) : (
          <Button size="lg" icon="play" full href={upNext.href}>
            Start
          </Button>
        )}
      </Card>
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
