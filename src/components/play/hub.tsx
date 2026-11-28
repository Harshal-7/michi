"use client";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionTitle } from "@/components/ui/page-header";
import { KANA_SETUPS } from "@/lib/games/kana/setups";

import { BoardRows, type BoardState, PlayerName } from "./bits";
import { usePlay } from "./player";
import { useBoard } from "./use-board";

/** The board the hub shows: the quick-play game, Read it · all 46 basic hiragana, this week. */
export const HUB_BOARD = { game: "kana", setup: KANA_SETUPS[0].key, label: "Kana game · Read it · Hiragana" } as const;

/** Under Play on the hero: the player's best this week, else who leads, else "be the first". */
export function HeroTop() {
  const { view, status } = useBoard(HUB_BOARD.game, HUB_BOARD.setup, "week");
  if (!view && status === "loading") return <span aria-hidden="true" className="h-10 w-36 animate-pulse-soft rounded-box bg-on-cobalt/20" />;
  if (!view) return null;
  const mine = view.me ?? view.top.find((p) => p.you) ?? null;
  const top = view.top[0];
  return (
    <p className="m-0 text-meta font-bold">
      {mine ? (
        <>
          Your best this week
          <br />
          <span className="font-medium">
            {mine.score} · {mine.firstTryRight} of {mine.cards} right
          </span>
        </>
      ) : top ? (
        <>
          Top this week
          <br />
          <span className="font-medium">
            <PlayerName name={top.name} /> · {top.score}
          </span>
        </>
      ) : (
        <>
          New week:
          <br />
          <span className="font-medium">be the first</span>
        </>
      )}
    </p>
  );
}

/** "Best 91" on a game's tile, once the player has played it. */
export function BestChip({ game }: { game: string }) {
  const { summary } = usePlay();
  const best = summary?.bests.find((b) => b.game === game);
  if (!best) return null;
  return <Chip kind="count">Best {best.score}</Chip>;
}

/** This week's top 3 on the hub, with what a new week, a board that didn't load or no signal look like. */
export function TopThree() {
  const { offline } = usePlay();
  const { view, status, reload } = useBoard(HUB_BOARD.game, HUB_BOARD.setup, "week");
  const state: BoardState = !view ? (status === "loading" ? "loading" : "stale") : status === "error" || offline ? "stale" : view.top.length === 0 ? "empty" : "ready";
  return (
    <section aria-labelledby="top-three" className="flex flex-col">
      <SectionTitle id="top-three" link={{ href: "/play/leaderboards", label: "See all" }}>
        This week’s top 3
      </SectionTitle>
      <p className="-mt-1.5 mb-1 text-meta text-ink2">{HUB_BOARD.label}</p>
      {!view && status === "error" ? (
        <CouldNotLoad onRetry={() => void reload()} />
      ) : state === "empty" ? (
        <EmptyState>A new week started on Monday. Any score here goes straight to the top.</EmptyState>
      ) : (
        <BoardRows places={(view?.top ?? []).slice(0, 3)} unit="kana" dense state={state} label="Kana game, this week" />
      )}
      {state === "stale" && view && <p className="m-0 mt-2 text-meta text-ink2">No signal. The boards come back with it.</p>}
    </section>
  );
}

/** The dashed box for a board that didn't load: the games still work. */
export function CouldNotLoad({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      action={
        <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>
          Try again
        </Button>
      }
    >
      The boards didn’t load. The games still work.
    </EmptyState>
  );
}

/** The passphrase sign-in, kept quiet at the foot of the hub for Harshal. */
export function OwnerSignIn() {
  const { player, loading } = usePlay();
  if (loading || player) return null;
  return (
    <Button variant="text" size="sm" href="/sign-in?next=/play" className="self-center">
      Owner sign in
    </Button>
  );
}
