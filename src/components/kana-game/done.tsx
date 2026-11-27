"use client";

import Link from "next/link";
import { useEffect } from "react";

import { type GameSummary, formatSeconds } from "@/lib/kana-game/score";
import { MODE_LABELS, type Mode } from "@/lib/kana-game/types";
import { ROUTES } from "@/lib/planner/day-plan";

import type { PlayResult } from "./play";

export type SaveStatus = { state: "idle" | "saving" | "saved" | "waiting"; waiting: number };

const CHECK = "M5 12.5l4.5 4.5L19 7.5";

const clock = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** The end of a game: the score, how it went, what to practise, and play again. */
export function GameDone({
  result,
  summary,
  mode,
  weakest,
  previousBest,
  save,
  onRetrySave,
  onAgain,
  onSettings,
}: {
  result: PlayResult;
  summary: GameSummary;
  mode: Mode;
  weakest: boolean;
  previousBest: number | null;
  save: SaveStatus;
  onRetrySave: () => void;
  onAgain: () => void;
  onSettings: () => void;
}) {
  const missed = result.cards.filter((c) => c.first && !c.first.right);
  const best = previousBest !== null && summary.score > previousBest;
  const accuracy = summary.cards ? Math.round((summary.firstTryRight / summary.cards) * 100) : 0;

  // Enter plays again.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (e.key === "Enter" && !e.repeat && !target?.closest("button, a, input")) onAgain();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAgain]);

  return (
    <>
      <header className="flex flex-col gap-0.5">
        <p className="m-0 text-[13px] text-ink2">
          {weakest ? "Weakest kana" : "Kana game"} · {MODE_LABELS[mode]}
        </p>
        <h1 className="m-0 font-head text-[30px] leading-[1.15]">{result.stopped ? "Stopped for now" : "Deck cleared"}</h1>
      </header>

      <section className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <p className="m-0 font-head text-[40px] leading-none">{summary.score}</p>
          <p className="m-0 text-[15px] text-ink2">score out of 100</p>
          {best && <p className="m-0 rounded-full bg-accent-soft px-3 py-1 text-[12.5px] font-semibold">Your best so far</p>}
        </div>
        <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-4">
          <Tile value={`${summary.firstTryRight} of ${summary.cards}`} label="right first time" note={`${accuracy}%`} />
          <Tile value={summary.meanMs === null ? "–" : formatSeconds(summary.meanMs)} label="per kana" note="when right" />
          <Tile value={String(result.bestStreak)} label="best run" note="in a row" />
          <Tile value={clock(result.durationMs)} label="time" note={result.stopped ? "before stopping" : "for the deck"} />
        </div>
        <SaveLine save={save} onRetry={onRetrySave} />
      </section>

      {missed.length > 0 ? (
        <section className="flex flex-col gap-2.5 rounded-card bg-surface p-4 shadow-card">
          <h2 className="m-0 text-[15px] font-bold">Missed on the first try</h2>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {missed.map((c) => (
              <li
                key={c.kana.id}
                className="inline-flex items-baseline gap-1.5 rounded-full border border-again px-2.5 py-[5px] text-[13px] text-again"
              >
                <span lang="ja" className="font-card text-base font-semibold">
                  {c.kana.kana}
                </span>
                <span>{c.kana.romaji}</span>
                {c.first?.given && (
                  <span className="text-ink2">
                    you {mode === "read" ? "typed " : "picked "}
                    <span lang={mode === "find" ? "ja" : undefined}>{c.first.given}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="m-0 text-[12.5px] text-ink2">They count towards your weakest kana, which you can practise from the start screen.</p>
        </section>
      ) : (
        !result.stopped && (
          <section className="rounded-card bg-surface px-4 py-3 shadow-card">
            <p className="m-0 text-sm">Every kana right on the first try.</p>
          </section>
        )
      )}

      <div className="flex flex-col gap-2">
        <button type="button" onClick={onAgain} className="min-h-14 rounded-btn bg-accent text-[17px] font-bold text-on-accent">
          Play again
        </button>
        <button type="button" onClick={onSettings} className="min-h-[50px] rounded-btn border border-line bg-surface text-[15px] font-bold">
          Change the game
        </button>
        <Link href={ROUTES.learn} className="inline-flex min-h-11 items-center self-center text-sm font-semibold text-ink2">
          Back to Learn
        </Link>
      </div>
      <p className="m-0 text-center text-[12.5px] text-ink2">
        The game&apos;s minutes count as study time in This week. Your reviews stay as they were.
      </p>
    </>
  );
}

function Tile({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-[14px] bg-surface2 px-1.5 py-2.5 text-center">
      <span className="text-xl font-bold">{value}</span>
      <span className="text-[12.5px] font-bold text-ink2">{label}</span>
      <span className="text-[11px] text-ink2">{note}</span>
    </div>
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
  if (save.state === "saving") return <p className="m-0 text-[13px] font-bold text-ink2">Saving…</p>;
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
