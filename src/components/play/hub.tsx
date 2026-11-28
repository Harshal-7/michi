"use client";
// design-lint: legacy

import Link from "next/link";

import { KANA_SETUPS } from "@/lib/games/kana/setups";

import { PlayerName, Podium, type PodiumState } from "./bits";
import { usePlay } from "./player";
import { useBoard } from "./use-board";

/** The board the hub shows: the quick-play game, Read it · all 46 basic hiragana, this week. */
export const HUB_BOARD = { game: "kana", setup: KANA_SETUPS[0].key, label: "Kana game · Read it · Hiragana" } as const;

/** The hub's greeting: for a visitor, what Play is; for a player, their best kana score. */
export function HubHeader() {
  const { player, summary, loading } = usePlay();
  const kanaBest = summary?.bests.find((b) => b.game === "kana")?.score ?? null;
  return (
    <header aria-busy={loading || undefined} className="flex flex-col gap-1">
      {loading ? (
        <>
          <span className="h-4 w-[150px] rounded-md bg-surface2" />
          <h1 className="m-0 text-[32px] leading-[1.1] font-black tracking-[-0.01em] laptop:text-[42px]">Japanese games</h1>
          <span className="mt-1 h-3 w-[92%] max-w-[480px] rounded-md bg-surface2" />
          <span className="h-3 w-[60%] max-w-[320px] rounded-md bg-surface2" />
        </>
      ) : (
        <>
          <p className="m-0 text-sm font-bold text-accent laptop:text-[15px]">
            {player ? (
              <>
                Welcome back, <PlayerName name={player.name} />
              </>
            ) : (
              "No sign-up, just play"
            )}
          </p>
          <h1 className="m-0 text-[32px] leading-[1.1] font-black tracking-[-0.01em] laptop:text-[42px]">{player ? "What’s next?" : "Japanese games"}</h1>
          <p className="m-0 text-sm leading-normal text-ink2 laptop:text-base">
            {player
              ? kanaBest !== null
                ? `Your best kana score is ${kanaBest}. Beat it, or try something new.`
                : "Pick a game. Your best scores show here."
              : "Short games for learners, about a minute each. Add a name at the end if you want to keep your score."}
          </p>
        </>
      )}
    </header>
  );
}

/** "Top this week / kaito · 100" on the quick-play card, or "be the first" on a new week. */
export function HeroTop() {
  const { view, status } = useBoard(HUB_BOARD.game, HUB_BOARD.setup, "week");
  if (!view && status === "loading") return <span className="h-[30px] w-24 rounded-lg bg-current opacity-20" />;
  if (!view) return null;
  const top = view.top[0];
  return (
    <span className="text-[12.5px] leading-[1.3] font-bold laptop:text-sm">
      {top ? (
        <>
          Top this week
          <br />
          <PlayerName name={top.name} /> · {top.score}
        </>
      ) : (
        <>
          New week:
          <br />
          be the first
        </>
      )}
    </span>
  );
}

/** "Best 91" on a game's card, once the player has played it. */
export function BestChip({ game }: { game: string }) {
  const { summary } = usePlay();
  const best = summary?.bests.find((b) => b.game === game);
  if (!best) return null;
  return <span className="relative mt-auto self-start rounded-full bg-surface px-2.5 py-1 text-xs font-bold laptop:px-3 laptop:text-[13px]">Best {best.score}</span>;
}

/** This week's top 3 on the hub, with what a new week or no signal looks like. */
export function TopThree() {
  const { offline } = usePlay();
  const { view, status, reload } = useBoard(HUB_BOARD.game, HUB_BOARD.setup, "week");
  const state: PodiumState = !view ? (status === "loading" ? "loading" : "stale") : status === "error" || offline ? "stale" : view.top.length === 0 ? "empty" : "ready";
  return (
    <section className="flex flex-col gap-3.5 rounded-game bg-surface p-[18px] shadow-card laptop:p-[22px]">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="m-0 text-lg font-black laptop:text-[19px]">This week’s top 3</h2>
          <p className="mt-0.5 mb-0 text-[12.5px] text-ink2 laptop:text-[13px]">{HUB_BOARD.label}</p>
        </div>
        <Link href="/play/leaderboards" className="inline-flex min-h-11 items-center text-sm font-bold text-accent no-underline">
          See all
        </Link>
      </div>
      {!view && status === "error" ? (
        <CouldNotLoad onRetry={() => void reload()} />
      ) : (
        <div className="laptop:mt-auto">
          <Podium top={view?.top ?? []} size="sm" state={state} />
        </div>
      )}
      {state === "empty" && <p className="m-0 rounded-[14px] bg-surface2 px-3 py-2.5 text-[13px] leading-[1.45]">A new week started on Monday. Any score here goes straight to the top.</p>}
      {state === "stale" && view && <p className="m-0 rounded-[14px] bg-surface2 px-3 py-2.5 text-[13px] leading-[1.45]">No signal. The boards come back with it.</p>}
    </section>
  );
}

/** The dashed box for a board that didn't load: the games still work. */
export function CouldNotLoad({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] border-2 border-dashed border-line px-4 py-3.5">
      <span className="flex-auto text-[13.5px] leading-[1.45]">The boards didn’t load. The games still work.</span>
      <button type="button" onClick={onRetry} className="min-h-11 rounded-btn border-2 border-ink px-4 text-sm font-black whitespace-nowrap">
        Try again
      </button>
    </div>
  );
}

/** The passphrase sign-in, kept quiet at the foot of the hub for Harshal. */
export function OwnerSignIn() {
  const { player, loading } = usePlay();
  if (loading || player) return null;
  return (
    <Link href="/sign-in?next=/play" className="inline-flex min-h-11 items-center self-center text-[13px] font-medium text-ink2 no-underline">
      Owner sign in
    </Link>
  );
}
