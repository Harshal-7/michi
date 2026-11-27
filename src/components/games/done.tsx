"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Avatar, BoardRowView, ordinal, PlayerName } from "@/components/play/bits";
import { usePlayMaybe } from "@/components/play/player";
import { useBoard } from "@/components/play/use-board";
import { hueStyle } from "@/lib/games/catalog";
import { type Place, placeFor } from "@/lib/games/leaderboard";
import { formatSeconds, type RunSummary } from "@/lib/games/score";

import type { SaveStatus } from "./use-saver";

const clock = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * The end of any game's run (P_SaveScore): the score as a stamp in the game's colour and how it
 * went; where it lands on this week's board; saving it, or "Save your score" for a player
 * without a name; what was missed (the game draws its own list as `missed`); and play again.
 */
export function GameDone({
  game,
  ranked,
  kicker,
  stopped,
  summary,
  unit,
  bestStreak,
  durationMs,
  previousBest,
  save,
  onRetrySave,
  missed,
  onAgain,
  onSettings,
  footnote,
}: {
  /** The game's slug, for its colour and board. */
  game: string;
  /** The run's setup key when it's a standard setup played to the end, else null. */
  ranked: string | null;
  /** "Kana game · Read it · Hiragana" */
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
  missed: React.ReactNode;
  onAgain: () => void;
  onSettings: () => void;
  footnote: string | null;
}) {
  const play = usePlayMaybe();
  const nameless = save.state === "nameless";
  const best = !nameless && previousBest !== null && summary.score > previousBest;
  const { view, reload } = useBoard(game, ranked, "week");

  // Once the run is saved, the board is fetched again to show its place.
  useEffect(() => {
    if (save.state === "saved" && ranked) void reload();
  }, [save.state, ranked, reload]);

  // Enter plays again.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (e.key === "Enter" && !e.repeat && !target?.closest("button, a, input, dialog")) onAgain();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAgain]);

  const wouldBe = nameless && ranked && view ? placeFor(summary.score, summary.meanMs, view.top) : null;
  const shownPlace = wouldBe !== null && wouldBe <= 20 ? wouldBe : null;
  const openSave = () => play?.openSheet({ kind: "save", score: summary.score, place: shownPlace });

  return (
    <div style={hueStyle(game)} className="mx-auto flex w-full max-w-[560px] flex-col gap-3.5">
      <section className="flex flex-col items-center gap-2.5 rounded-game bg-hue-tint px-5 pt-[22px] pb-[18px] text-center">
        <p className="m-0 text-[13px] font-black tracking-[0.04em] text-hue uppercase">{kicker}</p>
        <div role="img" aria-label={`Score ${summary.score} out of 100`} className="relative my-1.5">
          <div className="flex size-[132px] -rotate-6 flex-col items-center justify-center rounded-full border-4 border-hue text-hue outline-2 outline-offset-4 outline-hue">
            <span className="text-[54px] leading-none font-black">{summary.score}</span>
            <span className="text-[13px] font-black">out of 100</span>
          </div>
          {best && <span className="absolute -top-1 -right-12 rotate-3 rounded-full bg-accent px-3 py-1.5 text-[12.5px] font-black text-on-accent">New best!</span>}
        </div>
        <h1 className="m-0 text-[28px] leading-[1.1] font-black">{stopped ? "Stopped for now" : "Deck cleared!"}</h1>
        <div className="grid w-full grid-cols-4 gap-1.5">
          <Stat value={`${summary.firstTryRight}/${summary.cards}`} label="right first" />
          <Stat value={summary.meanMs === null ? "–" : formatSeconds(summary.meanMs)} label={`per ${unit}`} />
          <Stat value={String(bestStreak)} label="in a row" />
          <Stat value={clock(durationMs)} label="time" />
        </div>
      </section>

      {nameless ? (
        <section className="flex flex-col gap-3 rounded-game bg-surface p-[18px] shadow-hero">
          <div>
            <h2 className="m-0 text-xl font-black">{shownPlace ? `You’d be ${ordinal(shownPlace)} this week` : "Save your score"}</h2>
            <p className="mt-0.5 mb-0 text-[13.5px] text-ink2">
              {shownPlace ? "Save it to take the spot. No email, ten seconds." : "Keep it with a name and a 4-digit PIN, on any device. No email."}
            </p>
          </div>
          {shownPlace && view && <Neighbours place={shownPlace} top={view.top} score={summary.score} unit={unit} />}
          <button type="button" onClick={openSave} className="min-h-14 rounded-btn bg-accent text-[17px] font-black text-on-accent">
            Save my score
          </button>
        </section>
      ) : (
        <Saved save={save} onRetry={onRetrySave} ranked={ranked} view={view} unit={unit} />
      )}

      {missed}

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={onAgain}
          className={`inline-flex min-h-[54px] items-center justify-center gap-2 rounded-btn text-base font-black ${nameless ? "border-2 border-ink" : "bg-accent text-on-accent"}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
          Play again
        </button>
        <button type="button" onClick={onSettings} className="min-h-[54px] rounded-btn border-2 border-line bg-surface text-base font-bold">
          Change the game
        </button>
      </div>
      <Link href="/play" className="-mt-1 inline-flex min-h-11 items-center self-center text-sm font-bold text-ink2 no-underline">
        All games
      </Link>
      <p className="m-0 text-center text-[12.5px] text-ink2">{nameless ? "Not saved yet: this game is kept on this device for now." : footnote}</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-px rounded-[14px] bg-surface px-0.5 py-[9px]">
      <span className="text-[17px] font-black">{value}</span>
      <span className="text-[11.5px] text-ink2">{label}</span>
    </div>
  );
}

/** The places around where a nameless score would land, with a "You" row at its place. */
function Neighbours({ place, top, score, unit }: { place: number; top: readonly Place[]; score: number; unit: string }) {
  const above = top[place - 2];
  const below = top[place - 1];
  return (
    <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
      {above && <BoardRowView p={above} unit={unit} dense />}
      <li className="flex min-h-11 items-center gap-3 rounded-2xl bg-accent-soft px-3">
        <span className="w-6 text-[13px] font-black text-ink2">{place}</span>
        <span aria-hidden="true" className="inline-flex size-[30px] items-center justify-center rounded-full bg-accent text-[13px] font-black text-on-accent">
          ?
        </span>
        <span className="flex-auto text-[15px] font-bold">You</span>
        <span className="text-base font-black">{score}</span>
      </li>
      {below && <BoardRowView p={{ ...below, place: below.place + 1 }} unit={unit} dense />}
    </ol>
  );
}

/** For a player with a name: saving, saved with this week's place, or waiting for signal. */
function Saved({
  save,
  onRetry,
  ranked,
  view,
  unit,
}: {
  save: SaveStatus;
  onRetry: () => void;
  ranked: string | null;
  view: ReturnType<typeof useBoard>["view"];
  unit: string;
}) {
  if (save.state === "waiting") {
    return (
      <section className="flex flex-col gap-2 rounded-game bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" className="m-0 rounded-full bg-warn px-3 py-1.5 text-[12.5px] font-black text-page">
            {save.waiting === 1 ? "Waiting to save" : `${save.waiting} games waiting to save`}
          </p>
          <button type="button" onClick={onRetry} className="min-h-11 rounded-btn px-3 text-[13px] font-bold">
            Try again
          </button>
        </div>
        <p className="m-0 text-[12.5px] text-ink2">Kept on this device. It goes on the board when you’re back.</p>
      </section>
    );
  }
  if (save.state !== "saved" && !(save.state === "idle" && save.waiting === 0)) {
    return <p className="m-0 self-center rounded-full bg-surface2 px-3 py-1.5 text-[12.5px] font-bold">Saving…</p>;
  }
  const rows = view?.top ?? [];
  const mine = view ? (view.me ?? rows.find((p) => p.you) ?? null) : null;
  if (!ranked || !mine) {
    return (
      <p className="m-0 self-center rounded-full bg-good px-3 py-1.5 text-[12.5px] font-black text-page">
        ✓ Saved{ranked ? "" : " · this setup isn’t ranked"}
      </p>
    );
  }
  const above = mine.place > 1 ? rows[mine.place - 2] : null;
  const below = rows[mine.place];
  const gap = above ? above.score - mine.score : 0;
  return (
    <section className="flex flex-col gap-3 rounded-game bg-surface p-[18px] shadow-hero">
      <div>
        <div>
          <h2 className="m-0 text-xl font-black">Saved · {ordinal(mine.place)} this week</h2>
          <p className="mt-0.5 mb-0 text-[13.5px] text-ink2">
            {!above
              ? "Top of this week’s board."
              : gap > 0
                ? `${gap} more ${gap === 1 ? "point takes" : "points take"} ${ordinal(mine.place - 1)}.`
                : `A quicker game takes ${ordinal(mine.place - 1)}.`}
          </p>
        </div>
      </div>
      <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
        {above && mine.place <= 20 && <BoardRowView p={above} unit={unit} dense />}
        <li className="flex min-h-11 items-center gap-3 rounded-2xl bg-accent-soft px-3">
          <span className="w-6 text-[13px] font-black text-ink2">{mine.place}</span>
          <Avatar name={mine.name} size={30} />
          <span className="flex-auto truncate text-[15px] font-bold">
            <PlayerName name={mine.name} />
            <span className="font-medium text-ink2"> · you</span>
          </span>
          <span className="text-base font-black">{mine.score}</span>
        </li>
        {below && mine.place <= 20 && <BoardRowView p={below} unit={unit} dense />}
      </ol>
    </section>
  );
}
