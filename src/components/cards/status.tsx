"use client";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { getOutbox, type OutboxState } from "@/lib/srs/outbox";

/** The saving states (RF_States): grades waiting to save, no signal, and the notes that go with them. */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * "3 grades waiting to save", only once grades are held up. A save on its way right after an answer
 * isn't shown: it would push the screen down and up after every card.
 */
export function WaitingChip({ state }: { state: OutboxState }) {
  if (state.waiting === 0 || !state.stuck) return null;
  return (
    <p
      role="status"
      className="m-0 inline-flex items-center gap-2 self-start rounded-pill bg-cover-butter py-2 pr-3.5 pl-2.5 text-meta font-bold text-on-cover shadow-card"
    >
      <Icon name="cloud-up" size={18} />
      {plural(state.waiting, "grade")} waiting to save{state.offline ? " · retrying" : ""}
    </p>
  );
}

/**
 * "All grades saved" with a tick, or the waiting chip once grades are held up. `saving` shows
 * "Saving…" while the last ones are on their way (summaries); mid-session it stays as it was.
 */
export function SaveState({ state, total, saving = false }: { state: OutboxState; total?: number; saving?: boolean }) {
  if (state.waiting > 0 && state.stuck) return <WaitingChip state={state} />;
  if (state.waiting > 0 && saving) return <p className="m-0 text-meta font-bold text-ink2">Saving…</p>;
  return (
    <p className="m-0 flex items-center gap-2 text-meta font-bold text-good">
      <Icon name="check" size={16} stroke={2.2} />
      {total === undefined ? "All grades saved" : total === 1 ? "Your grade is saved" : `All ${total} grades saved`}
    </p>
  );
}

export function NoSignal({ newSession = true }: { newSession?: boolean }) {
  return (
    <Banner kind="offline" title="You’re offline">
      Your grades are kept on this phone and save when you’re back online.{newSession && " A new session needs signal."}
    </Banner>
  );
}

/** Notes about saving: no signal, signed out, grades dropped as stale. */
export function SaveNotes({ state }: { state: OutboxState }) {
  return (
    <>
      {state.offline && <NoSignal />}
      {state.signedOut && (
        <Banner kind="waiting" role="alert" title={`${plural(state.waiting, "grade")} can’t save yet`}>
          You were signed out.{" "}
          <a href="/sign-in?next=/review" className="font-bold underline underline-offset-2">
            Sign in again
          </a>{" "}
          and they’ll save.
        </Banner>
      )}
      {state.stale > 0 && (
        <Banner
          kind="info"
          title={state.stale === 1 ? "1 grade wasn’t saved" : `${state.stale} grades weren’t saved`}
          action={
            <Button variant="secondary" size="sm" onClick={() => getOutbox().clearStale()}>
              OK
            </Button>
          }
        >
          The card was already reviewed on another device, and that review counts.
        </Banner>
      )}
    </>
  );
}
