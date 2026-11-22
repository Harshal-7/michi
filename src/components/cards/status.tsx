"use client";

import { getOutbox, type OutboxState } from "@/lib/srs/outbox";

/** The states on F_Parts: grades waiting to save, no signal, and the notes that go with them. */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "3 grades waiting to save · retrying", or nothing when everything is saved. */
export function WaitingChip({ state }: { state: OutboxState }) {
  if (state.waiting === 0) return null;
  return (
    <p
      role="status"
      className="m-0 self-start rounded-full border border-warn bg-surface px-3 py-1.5 text-[12.5px] font-bold text-warn"
    >
      {plural(state.waiting, "grade")} waiting to save{state.offline ? " · retrying" : ""}
    </p>
  );
}

const CHECK = "M5 12.5l4.5 4.5L19 7.5";

/** "All grades saved" with a tick, or the waiting chip. */
export function SaveState({ state, total }: { state: OutboxState; total?: number }) {
  if (state.waiting > 0) return <WaitingChip state={state} />;
  return (
    <p className="m-0 flex items-center gap-2 text-[13px] font-bold text-good">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={CHECK} />
      </svg>
      {total === undefined ? "All grades saved" : total === 1 ? "Your grade is saved" : `All ${total} grades saved`}
    </p>
  );
}

const NOTE = "m-0 rounded-xl bg-surface2 px-3 py-2.5 text-[12.5px] leading-[1.45]";

export function NoSignal({ newSession = true }: { newSession?: boolean }) {
  return (
    <p role="status" className={NOTE}>
      No signal. Your grades are kept on this phone and save when you&apos;re back online.
      {newSession && " A new session needs signal."}
    </p>
  );
}

/** Notes about saving: no signal, signed out, grades dropped as stale. */
export function SaveNotes({ state }: { state: OutboxState }) {
  return (
    <>
      {state.offline && <NoSignal />}
      {state.signedOut && (
        <p role="alert" className={NOTE}>
          You were signed out, so {plural(state.waiting, "grade")} can&apos;t save yet.{" "}
          <a href="/sign-in?next=/review" className="font-bold">
            Sign in again
          </a>{" "}
          and they&apos;ll save.
        </p>
      )}
      {state.stale > 0 && (
        <div role="status" className={`${NOTE} flex items-center gap-3`}>
          <span className="flex-auto">
            {state.stale === 1 ? "1 grade wasn't saved" : `${state.stale} grades weren't saved`}: the card was already
            reviewed on another device, and that review counts.
          </span>
          <button
            type="button"
            onClick={() => getOutbox().clearStale()}
            className="min-h-9 shrink-0 rounded-btn border border-line bg-surface px-3 text-[12.5px] font-bold"
          >
            OK
          </button>
        </div>
      )}
    </>
  );
}
