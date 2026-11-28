"use client";

import Link from "next/link";
import { useEffect } from "react";

import { formatSeconds, type RunSummary } from "@/lib/games/score";

import { Tile } from "./parts";
import type { SaveStatus } from "./use-saver";

const CHECK = "M5 12.5l4.5 4.5L19 7.5";

const clock = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * The end of any game's run: the score, how it went, what was missed (the game draws its own
 * list as `missed`), saving, and play again.
 */
export function GameDone({
  kicker,
  stopped,
  summary,
  unit,
  bestStreak,
  durationMs,
  previousBest,
  save,
  onRetrySave,
  saveScore,
  missed,
  onAgain,
  onSettings,
  footnote,
}: {
  /** "Kana game · Read it" */
  kicker: string;
  stopped: boolean;
  summary: RunSummary;
  /** What a card is: "kana". */
  unit: string;
  bestStreak: number;
  durationMs: number;
  previousBest: number | null;
  save: SaveStatus;
  onRetrySave: () => void;
  /** What a nameless player sees in place of "Saved": the way to "Save your score". */
  saveScore: React.ReactNode;
  missed: React.ReactNode;
  onAgain: () => void;
  onSettings: () => void;
  footnote: string | null;
}) {
  const best = previousBest !== null && summary.score > previousBest;
  const accuracy = summary.cards ? Math.round((summary.firstTryRight / summary.cards) * 100) : 0;

  // Enter plays again.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (e.key === "Enter" && !e.repeat && !target?.closest("button, a, input, dialog")) onAgain();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAgain]);

  return (
    <>
      <header className="flex flex-col gap-0.5">
        <p className="m-0 text-[13px] text-ink2">{kicker}</p>
        <h1 className="m-0 font-head text-[30px] leading-[1.15]">{stopped ? "Stopped for now" : "Deck cleared"}</h1>
      </header>

      <section className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <p className="m-0 font-head text-[40px] leading-none">{summary.score}</p>
          <p className="m-0 text-[15px] text-ink2">score out of 100</p>
          {best && <p className="m-0 rounded-full bg-accent-soft px-3 py-1 text-[12.5px] font-semibold">Your best so far</p>}
        </div>
        <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-4">
          <Tile value={`${summary.firstTryRight} of ${summary.cards}`} label="right first time" note={`${accuracy}%`} />
          <Tile value={summary.meanMs === null ? "–" : formatSeconds(summary.meanMs)} label={`per ${unit}`} note="when right" />
          <Tile value={String(bestStreak)} label="best run" note="in a row" />
          <Tile value={clock(durationMs)} label="time" note={stopped ? "before stopping" : "for the deck"} />
        </div>
        {save.state === "nameless" ? saveScore : <SaveLine save={save} onRetry={onRetrySave} />}
      </section>

      {missed}

      <div className="flex flex-col gap-2">
        <button type="button" onClick={onAgain} className="min-h-14 rounded-btn bg-accent text-[17px] font-bold text-on-accent">
          Play again
        </button>
        <button type="button" onClick={onSettings} className="min-h-[50px] rounded-btn border border-line bg-surface text-[15px] font-bold">
          Change the game
        </button>
        <Link href="/play" className="inline-flex min-h-11 items-center self-center text-sm font-semibold text-ink2">
          All games
        </Link>
      </div>
      {footnote && <p className="m-0 text-center text-[12.5px] text-ink2">{footnote}</p>}
    </>
  );
}

function SaveLine({ save, onRetry }: { save: SaveStatus; onRetry: () => void }) {
  if (save.state === "saved" || (save.state === "idle" && save.waiting === 0)) {
    return (
      <p className="m-0 flex items-center gap-2 text-[13px] font-bold text-good">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={CHECK} />
        </svg>
        Saved
      </p>
    );
  }
  if (save.state === "saving" || save.state === "idle") return <p className="m-0 text-[13px] font-bold text-ink2">Saving…</p>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p role="status" className="m-0 rounded-full border border-warn bg-surface px-3 py-1.5 text-[12.5px] font-bold text-warn">
        {save.waiting === 1 ? "Waiting to save" : `${save.waiting} games waiting to save`}
      </p>
      <button type="button" onClick={onRetry} className="min-h-11 rounded-btn px-3 text-[13px] font-semibold text-ink">
        Try again
      </button>
      <p className="m-0 w-full text-[12.5px] text-ink2">It&apos;s kept on this device and saves next time there&apos;s signal.</p>
    </div>
  );
}
