"use client";

import { useEffect } from "react";

import { Rabbit } from "@/components/ui/art/rabbit";
import { Hanamaru, WashiTape } from "@/components/ui/art/rewards";
import { Banner } from "@/components/ui/banner";
import { Button, Spinner } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { BoardRowView, Kbd, ordinal, PlaceBadge } from "@/components/play/bits";
import { usePlayMaybe } from "@/components/play/player";
import { useBoard } from "@/components/play/use-board";
import { hueStyle } from "@/lib/games/catalog";
import { type Place, placeFor } from "@/lib/games/leaderboard";
import { formatSeconds, type RunSummary } from "@/lib/games/score";

import { Tile } from "./parts";
import type { SaveStatus } from "./use-saver";

const clock = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * The end of any game's run (RF_PlayDone): the score in the red-pencil ring with the cheering rabbit
 * and "New best!", how it went; where it lands on this week's board; saving it, or "Save your score"
 * for a player without a name; what was missed (the game draws its own list as `missed`); and play
 * again (Enter).
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
    <div style={hueStyle(game)} className="mx-auto flex w-full max-w-140 flex-col">
      <section className="flex flex-col items-center pt-1 text-center">
        <Chip cover="blue">{kicker}</Chip>
        <div className="relative mt-0.5">
          <div role="img" aria-label={`Score ${summary.score} out of 100${best ? ", a new best" : ""}`} className="relative h-44.25 w-62">
            {!stopped && <Hanamaru width={248} className="absolute top-0 left-0" />}
            <div className="absolute inset-x-0 top-0 flex h-42.25 flex-col items-center justify-center">
              <span className="text-kana leading-none font-black tracking-[-0.02em] tabular-nums">{summary.score}</span>
              <span className="text-meta font-bold text-ink2">out of 100</span>
            </div>
          </div>
          {best && (
            <span className="absolute top-6.5 -right-12.5 inline-flex h-7.5 rotate-6 items-center rounded-track bg-hanamaru px-3 text-meta leading-none font-black text-on-accent shadow-btn">
              New best!
            </span>
          )}
          <div className="absolute -bottom-0.5 -left-17">
            <Rabbit pose="cheering" size={92} />
          </div>
        </div>
        <h1 className="m-0 mt-0.5 text-headline font-black">{stopped ? "Stopped for now" : "Deck cleared!"}</h1>
        {!stopped && (
          <p lang="ja" className="m-0 -rotate-3 font-ja text-lead text-hanamaru">
            よくできました
          </p>
        )}
      </section>

      <dl className="m-0 mt-4 grid grid-cols-4 gap-2">
        <Tile value={`${summary.firstTryRight}/${summary.cards}`} label="right first" />
        <Tile value={summary.meanMs === null ? "–" : formatSeconds(summary.meanMs)} label={`per ${unit}`} />
        <Tile value={String(bestStreak)} label="in a row" />
        <Tile value={clock(durationMs)} label="time" />
      </dl>

      <div className="mt-5.5">
        {nameless ? (
          <Card className="relative flex flex-col gap-3 px-4 pt-4 pb-3.5">
            <WashiTape className="absolute -top-2.5 left-5.5" />
            <div>
              <h2 className="m-0 text-title font-black">{shownPlace ? `You’d be ${ordinal(shownPlace)} this week` : "Save your score"}</h2>
              <p className="m-0 text-meta text-ink2">
                {shownPlace ? "Save it to take the spot. No email, ten seconds." : "Keep it with a name and a 4-digit PIN, on any device. No email."}
              </p>
            </div>
            {shownPlace && view && <Neighbours place={shownPlace} top={view.top} score={summary.score} unit={unit} />}
            <Button size="lg" full onClick={openSave}>
              Save my score
            </Button>
          </Card>
        ) : (
          <Saved save={save} onRetry={onRetrySave} ranked={ranked} view={view} unit={unit} score={summary.score} previousBest={previousBest} />
        )}
      </div>

      {missed && <div className="mt-4">{missed}</div>}

      <div className="mt-4.5 grid grid-cols-2 gap-2.5">
        <Button size="lg" variant={nameless ? "secondary" : "primary"} icon="play" onClick={onAgain} aria-keyshortcuts="Enter">
          Play again
        </Button>
        {ranked ? (
          <Button size="lg" variant="secondary" icon="trophy" href={`/play/leaderboards?${new URLSearchParams({ game, setup: ranked })}`}>
            See the board
          </Button>
        ) : (
          <Button size="lg" variant="secondary" onClick={onSettings}>
            Change the game
          </Button>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3">
        <Button variant="quiet" icon="chevron-left" iconEnd={null} href="/play">
          All games
        </Button>
        {ranked ? (
          <Button variant="quiet" iconEnd={null} onClick={onSettings}>
            Change the game
          </Button>
        ) : (
          <span className="flex items-center gap-2 text-meta text-ink2">
            <Kbd>Enter</Kbd>
            plays again
          </span>
        )}
      </div>
      {ranked && (
        <p className="m-0 flex items-center justify-center gap-2 text-meta text-ink2">
          <Kbd>Enter</Kbd>
          plays again
        </p>
      )}
      {(nameless || footnote) && <p className="m-0 mt-3 text-center text-meta text-ink2">{nameless ? "Not saved yet: this game is kept on this device for now." : footnote}</p>}
    </div>
  );
}

/** The places around where a nameless score would land, with a "You" row at its place. */
function Neighbours({ place, top, score, unit }: { place: number; top: readonly Place[]; score: number; unit: string }) {
  const above = top[place - 2];
  const below = top[place - 1];
  return (
    <ol aria-label="This week’s board around your score" className="m-0 flex list-none flex-col gap-0.5 p-0">
      {above && <BoardRowView p={above} unit={unit} dense />}
      <li className="flex min-h-11 items-center gap-3 rounded-btn bg-accent-soft pr-3.5 pl-2">
        <PlaceBadge place={place} />
        <span className="flex-auto text-body font-bold">You</span>
        <span className="text-lead font-black tabular-nums">{score}</span>
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
  score,
  previousBest,
}: {
  save: SaveStatus;
  onRetry: () => void;
  ranked: string | null;
  view: ReturnType<typeof useBoard>["view"];
  unit: string;
  score: number;
  previousBest: number | null;
}) {
  if (save.state === "waiting") {
    return (
      <Banner
        kind="waiting"
        title={save.waiting === 1 ? "Waiting to save" : `${save.waiting} games waiting to save`}
        action={
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        }
      >
        Kept on this device. It goes on the board when you’re back.
      </Banner>
    );
  }
  if (save.state !== "saved" && !(save.state === "idle" && save.waiting === 0)) {
    return (
      <p role="status" className="m-0 flex items-center justify-center gap-2 text-meta font-bold text-ink2">
        <Spinner size={16} />
        Saving…
      </p>
    );
  }
  const rows = view?.top ?? [];
  const mine = view ? (view.me ?? rows.find((p) => p.you) ?? null) : null;
  if (!ranked || !mine) {
    return (
      <p role="status" className="m-0 flex items-center justify-center gap-1.5 text-body font-bold text-good">
        <Icon name="check" size={20} stroke={2.6} />
        Saved{ranked ? "" : " · this setup isn’t ranked"}
      </p>
    );
  }
  const above = mine.place > 1 ? rows[mine.place - 2] : null;
  const below = rows[mine.place];
  const gap = above ? above.score - mine.score : 0;
  const up = previousBest !== null && score > previousBest ? `Up from your ${previousBest}. ` : "";
  return (
    <Card className="relative flex flex-col gap-2 px-3.5 pt-4 pb-2.5">
      <WashiTape className="absolute -top-2.5 left-5.5" />
      <div className="px-1">
        <h2 className="m-0 text-title font-black">Saved · {ordinal(mine.place)} this week</h2>
        <p className="m-0 text-meta text-ink2">
          {up}
          {!above
            ? "Top of this week’s board."
            : gap > 0
              ? `${gap} more ${gap === 1 ? "point takes" : "points take"} ${ordinal(mine.place - 1)}.`
              : `A quicker game takes ${ordinal(mine.place - 1)}.`}
        </p>
      </div>
      <ol aria-label="This week’s board around you" className="m-0 flex list-none flex-col gap-0.5 p-0">
        {above && mine.place <= 20 && <BoardRowView p={above} unit={unit} dense />}
        <BoardRowView p={mine} unit={unit} dense />
        {below && mine.place <= 20 && <BoardRowView p={below} unit={unit} dense />}
      </ol>
    </Card>
  );
}
