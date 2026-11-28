"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { Rabbit } from "@/components/ui/art/rabbit";
import { CATALOG, hueStyle, isLive } from "@/lib/games/catalog";
import { type Period, PERIODS } from "@/lib/games/leaderboard";
import { gameBySlug, GAMES } from "@/lib/games/registry";
import { studyDate, weekOf } from "@/lib/day";

import { BoardRows, BoardRowView, type BoardState, GameGlyph, gameTone } from "./bits";
import { CouldNotLoad } from "./hub";
import { usePlay } from "./player";
import { useBoard } from "./use-board";

const PERIOD_LABELS: Record<Period, string> = { week: "This week", all: "All time" };

const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** A setup's label after its mode: "Read it · Hiragana · 46" → "Hiragana · 46". */
const rest = (label: string) => label.split(" · ").slice(1).join(" · ");

/** The board's dates, "Mon 23 – Sun 29 Nov", from the study day (IST, 4 am). */
function weekLabel(): string {
  const { start, end } = weekOf(studyDate());
  const fmt = (d: string, month: boolean) => {
    const date = new Date(`${d}T00:00:00Z`);
    const day = date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });
    return month ? `${day} ${date.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}` : day;
  };
  return `${fmt(start, start.slice(5, 7) !== end.slice(5, 7))} – ${fmt(end, true)}`;
}

/** The choice in the address (`?game=kana&setup=…&period=all`), read in the browser so the page stays static. */
function fromAddress() {
  const q = new URLSearchParams(window.location.search);
  const game = gameBySlug(q.get("game") ?? "") ?? GAMES[0];
  const setup = game.setups.find((s) => s.key === q.get("setup"))?.key ?? game.setups[0].key;
  const period = PERIODS.find((p) => p === q.get("period")) ?? "week";
  return { game: game.slug, setup, period };
}

/**
 * The leaderboards (RF_PlayLeaderboard): the week or all time, the game, its mode and setup, then the
 * top 20 with the top 3 on cover-coloured stickers, and your place when you're further down.
 */
export function Leaderboards() {
  const [choice, setChoice] = useState<Choice | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address is read in the browser
    setChoice(fromAddress());
  }, []);
  if (!choice)
    return (
      <div className="mx-auto w-full max-w-150">
        <Header />
      </div>
    );
  const choose = (c: Partial<Choice>) => {
    const next = { ...choice, ...c };
    if (c.game && c.game !== choice.game) next.setup = gameBySlug(c.game)!.setups[0].key;
    setChoice(next);
    const q = new URLSearchParams({ game: next.game, setup: next.setup, period: next.period });
    window.history.replaceState(null, "", `/play/leaderboards?${q}`);
  };
  return <Boards choice={choice} onChoose={choose} />;
}

type Choice = { game: string; setup: string; period: Period };

function Header() {
  return (
    <header className="flex h-15 items-end justify-between">
      <h1 className="m-0 text-headline font-black tracking-[-0.01em] laptop:text-display">Leaderboards</h1>
      <div className="mr-1 -mb-1.5">
        <Rabbit pose="cheering" size={82} />
      </div>
    </header>
  );
}

function Boards({ choice, onChoose }: { choice: Choice; onChoose: (c: Partial<Choice>) => void }) {
  const { offline } = usePlay();
  const entry = gameBySlug(choice.game)!;
  const { view, status, reload } = useBoard(choice.game, choice.setup, choice.period);
  const unit = choice.game === "kana" ? "kana" : "answer";
  const top = view?.top ?? [];
  const empty = view !== null && top.length === 0;
  const state: BoardState = !view ? (status === "loading" ? "loading" : "stale") : status === "error" || offline ? "stale" : empty ? "empty" : "ready";
  const setupLabel = entry.setups.find((s) => s.key === choice.setup)?.label ?? "";
  const modes = entry.modes;
  const mode = entry.setups.find((s) => s.key === choice.setup)?.mode ?? modes[0]?.key;
  const soon = CATALOG.filter((g) => !isLive(g.slug)).length;

  return (
    <div className="mx-auto flex w-full max-w-150 flex-col">
      <Header />
      <Segmented
        label="When"
        name="period"
        value={choice.period}
        onChange={(period) => onChoose({ period })}
        options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABELS[p] }))}
        className="mt-2.5"
      />

      <div role="radiogroup" aria-label="Game" className="mt-3 grid grid-cols-7 gap-1 laptop:gap-2">
        {CATALOG.map((g) => {
          const on = g.slug === choice.game;
          const live = isLive(g.slug);
          return (
            <button
              key={g.slug}
              type="button"
              role="radio"
              aria-checked={on}
              aria-disabled={!live || undefined}
              aria-label={live ? g.name : `${g.name}, coming soon`}
              onClick={() => live && onChoose({ game: g.slug })}
              style={hueStyle(g.slug)}
              className={`flex h-15.5 min-w-0 flex-col items-center justify-center gap-0.5 rounded-btn p-0 laptop:h-20 ${on ? "bg-hue text-hue-tint" : "bg-hue-tint text-ink2"} ${live ? "" : "cursor-default"}`}
            >
              <GameGlyph glyph={g.glyph} size={28} className={`laptop:size-9 ${on ? "" : gameTone(g.slug)}`} />
              <span className="text-caption font-bold">
                {live ? (
                  <>
                    <span className="laptop:hidden">{g.short}</span>
                    <span className="hidden laptop:inline">{g.name}</span>
                  </>
                ) : (
                  "Soon"
                )}
              </span>
            </button>
          );
        })}
      </div>
      <p className="m-0 mt-2 text-meta text-ink2">
        <span className="font-bold text-ink">{entry.name}</span>
        {soon > 0 && ` · ${COUNT_WORDS[soon] ?? soon} more ${soon === 1 ? "game" : "games"} coming soon`}
      </p>

      {modes.length > 1 && (
        <Segmented
          label="How to play"
          name="mode"
          value={mode}
          onChange={(m) => {
            const same = entry.setups.find((s) => s.mode === m && rest(s.label) === rest(setupLabel));
            onChoose({ setup: (same ?? entry.setups.find((s) => s.mode === m)!).key });
          }}
          options={modes.map((m) => ({ value: m.key, label: m.label }))}
          className="mt-2.5"
        />
      )}
      <ChoiceChips
        label="Setup"
        value={choice.setup}
        onChange={(setup) => onChoose({ setup })}
        options={entry.setups.filter((s) => s.mode === mode).map((s) => ({ value: s.key, label: modes.length > 1 ? rest(s.label) : s.label }))}
        className="mt-2.5"
      />

      <section aria-label={`${entry.name} · ${setupLabel}`} className="mt-3 rounded-card border-[1.5px] border-line bg-surface px-2 pt-3 pb-2 shadow-card">
        <p className="m-0 px-2 pb-1.5 text-meta text-ink2">
          {choice.period === "week" ? `${weekLabel()} · ${empty ? "started this week" : "new week on Monday"}` : "All time · each player’s best score"}
        </p>
        {!view && status === "error" ? (
          <div className="p-2">
            <CouldNotLoad onRetry={() => void reload()} />
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center gap-2 px-4 pt-4 pb-3 text-center">
            <h2 className="m-0 text-title font-black">No scores yet{choice.period === "week" ? " this week" : ""}</h2>
            <p className="m-0 text-body text-ink2">
              {choice.period === "week" ? "The board starts fresh every Monday." : "Nobody has played this one yet."} Play {rest(setupLabel)} now and you’re first.
            </p>
            <Button size="lg" icon="play" href={`${entry.href}?setup=${encodeURIComponent(choice.setup)}`} className="mt-2">
              Play and be first
            </Button>
            {choice.period === "week" && (
              <Button variant="quiet" onClick={() => onChoose({ period: "all" })}>
                See all time instead
              </Button>
            )}
          </div>
        ) : (
          <>
            <BoardRows places={top} unit={unit} state={state} label={`${PERIOD_LABELS[choice.period]}, top ${top.length}`} />
            {view?.me && (
              <ol aria-label="Your place" className="m-0 mt-1 list-none border-t-[1.5px] border-dashed border-line pt-1 pl-0">
                <BoardRowView p={view.me} unit={unit} />
              </ol>
            )}
            {top.length > 0 && top.length <= 3 && (
              <p className="m-0 px-2 pt-2 pb-1 text-meta text-ink2">
                {top.length === 1 ? "Only one player" : `Only ${top.length} players`} on this board so far. Places 4 to 20 show here.
              </p>
            )}
          </>
        )}
      </section>
      <p className="m-0 mt-3 text-meta text-ink2">Each player’s best score counts once. Ties go to the quicker player.</p>
    </div>
  );
}
