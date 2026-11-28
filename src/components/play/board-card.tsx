"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

import { ordinal, PlayerName } from "./bits";
import { CouldNotLoad } from "./hub";
import { usePlayMaybe } from "./player";
import { useBoard } from "./use-board";

/**
 * A game's board on its start screen (RF_PlayKanaStart): one row with your best this week and your
 * place, who leads, and the way to the full board. A setup that isn't a standard one has no board;
 * the box says so and offers the nearest one (`nearest`).
 */
export function BoardCard({
  game,
  setup,
  label,
  nearest,
}: {
  game: string;
  /** The picked setup's key when it's a standard one, else null. */
  setup: string | null;
  /** "Read it · Hiragana · 46", or the picked mix when it isn't ranked. */
  label: string;
  nearest: { label: string; onSwitch: () => void } | null;
}) {
  const play = usePlayMaybe();
  const { view, status, reload } = useBoard(game, setup, "week");
  if (!setup) {
    return (
      <section aria-label="Leaderboard" className="flex flex-col items-start gap-1 rounded-btn-lg bg-surface2 px-4 py-3.5">
        <h2 className="m-0 text-body font-bold">This mix isn’t ranked</h2>
        <p className="m-0 text-meta text-ink2">Boards use a few standard games, so everyone plays the same one. You can still play this mix.</p>
        {nearest && (
          <Button variant="secondary" size="sm" onClick={nearest.onSwitch} className="mt-1.5">
            Switch to {nearest.label}
          </Button>
        )}
      </section>
    );
  }
  if (!view && status === "error") return <CouldNotLoad onRetry={() => void reload()} />;

  const top = view?.top ?? [];
  const mine = view ? (view.me ?? top.find((p) => p.you) ?? null) : null;
  const leader = top[0] && !top[0].you ? top[0] : null;
  const stale = status === "error" || play?.offline;
  const nameless = play !== null && !play.loading && play.player === null;
  return (
    <Link
      href={`/play/leaderboards?${new URLSearchParams({ game, setup })}`}
      aria-label={`This week’s board, ${label}`}
      className={`flex min-h-14 items-center gap-3 rounded-btn-lg bg-surface2 py-2 pr-3.5 pl-2.5 text-ink no-underline hover:bg-accent-soft ${stale ? "opacity-60" : ""}`}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-cover-butter text-on-cover shadow-sticker">
        <Icon name="trophy" size={20} />
      </span>
      {!view ? (
        <span aria-hidden="true" className="flex flex-auto flex-col gap-2">
          <span className="h-3 w-3/5 animate-pulse-soft rounded-full bg-line" />
          <span className="h-3 w-4/5 animate-pulse-soft rounded-full bg-line" />
        </span>
      ) : (
        <span className="flex min-w-0 flex-auto flex-col">
          <span className="text-body font-bold">
            {mine ? `Best this week: ${mine.score} · ${ordinal(mine.place)}` : top.length === 0 ? "Nobody’s on this week’s board yet" : "This week’s board"}
          </span>
          <span className="text-meta text-ink2">
            {label}
            {leader && (
              <>
                {" · "}
                <PlayerName name={leader.name} /> leads with {leader.score}
              </>
            )}
            {top.length === 0 && " · play now and you’re first"}
            {nameless && top.length > 0 && " · save a score to get your name on it"}
          </span>
        </span>
      )}
      <Icon name="chevron-right" size={20} className="text-ink3" />
    </Link>
  );
}
