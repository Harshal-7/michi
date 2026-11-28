"use client";
// design-lint: legacy

import Link from "next/link";

import { BoardRowView, Podium, type PodiumState } from "./bits";
import { CouldNotLoad } from "./hub";
import { usePlayMaybe } from "./player";
import { useBoard } from "./use-board";

/**
 * A game's leaderboard on its start screen (P_BoardCard): this week's top 3, 4th place and yours,
 * for the setup picked. A setup that isn't a standard one has no board; the card says so and
 * offers the nearest one (`onSwitch`).
 */
export function BoardCard({
  game,
  setup,
  label,
  unit,
  nearest,
}: {
  game: string;
  /** The picked setup's key when it's a standard one, else null. */
  setup: string | null;
  /** "Read it · Hiragana · Basic · 20", or the picked mix when it isn't ranked. */
  label: string;
  unit: string;
  nearest: { label: string; onSwitch: () => void } | null;
}) {
  const play = usePlayMaybe();
  const { view, status, reload } = useBoard(game, setup, "week");
  const top = view?.top ?? [];
  const mine = view ? (view.me ?? top.find((p) => p.you && p.place > 4) ?? null) : null;
  const empty = view !== null && top.length === 0;
  const state: PodiumState = !view ? (status === "loading" ? "loading" : "stale") : status === "error" || play?.offline ? "stale" : empty ? "empty" : "ready";
  const nameless = play !== null && !play.loading && play.player === null;
  return (
    <section className="flex flex-col gap-3.5 rounded-game bg-surface p-[18px] shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="m-0 text-[19px] font-black">{setup ? "This week’s board" : "Leaderboard"}</h2>
          <p className="mt-0.5 mb-0 text-[13px] text-ink2">{label}</p>
        </div>
        <Link
          href={setup ? `/play/leaderboards?${new URLSearchParams({ game, setup })}` : `/play/leaderboards?game=${game}`}
          className="-mt-2.5 inline-flex min-h-11 items-center text-sm font-black text-accent no-underline"
        >
          See all
        </Link>
      </div>
      {!setup ? (
        <div className="flex flex-col gap-2.5 rounded-2xl bg-surface2 p-3.5">
          <p className="m-0 text-[15px] font-black">This mix isn’t ranked</p>
          <p className="m-0 text-[13.5px] leading-[1.45] text-ink2">Boards use a few standard games, so everyone plays the same one. You can still play this mix.</p>
          {nearest && (
            <button type="button" onClick={nearest.onSwitch} className="min-h-11 self-start rounded-btn border-2 border-ink px-[18px] text-sm font-black">
              Switch to {nearest.label}
            </button>
          )}
        </div>
      ) : !view && status === "error" ? (
        <CouldNotLoad onRetry={() => void reload()} />
      ) : (
        <>
          <Podium top={top} state={state} />
          {state === "empty" && <p className="m-0 rounded-[14px] bg-surface2 px-3 py-2.5 text-[13px] leading-[1.45]">Nobody’s on this week’s board yet. Play now and you’re first.</p>}
          {(top[3] || mine) && (
            <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
              {top[3] && <BoardRowView p={top[3]} unit={unit} dense />}
              {mine && mine.place !== 4 && <BoardRowView p={mine} unit={unit} dense />}
            </ol>
          )}
          {nameless && !empty && (
            <p className="m-0 rounded-2xl border-2 border-dashed border-line px-3.5 py-3 text-center text-[13.5px] leading-[1.45]">
              Play this setup, then save your score to see your name here.
            </p>
          )}
        </>
      )}
    </section>
  );
}
