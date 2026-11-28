"use client";
// design-lint: legacy

import Link from "next/link";
import { useEffect, useState } from "react";

import { CATALOG, hueStyle, isLive } from "@/lib/games/catalog";
import { type Period, PERIODS } from "@/lib/games/leaderboard";
import { gameBySlug, GAMES } from "@/lib/games/registry";
import { studyDate, weekOf } from "@/lib/day";

import { Avatar, BoardRowView, ordinal, PlayerName, PlayTriangle, placeLine, Podium, type PodiumState } from "./bits";
import { CouldNotLoad } from "./hub";
import { usePlay } from "./player";
import { useBoard } from "./use-board";

const PERIOD_LABELS: Record<Period, string> = { week: "This week", all: "All time" };

/** A setup's label after its mode: "Read it · Hiragana · Basic · 20" → "Hiragana · Basic · 20". */
const rest = (label: string) => label.split(" · ").slice(1).join(" · ");

/** The board's dates, "MON 23 – SUN 29 NOV", from the study day (IST, 4 am). */
function weekLabel(): string {
  const { start, end } = weekOf(studyDate());
  const fmt = (d: string, month: boolean) => {
    const date = new Date(`${d}T00:00:00Z`);
    const day = date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });
    return month ? `${day} ${date.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}` : day;
  };
  return `${fmt(start, start.slice(5, 7) !== end.slice(5, 7))} – ${fmt(end, true)}`.toUpperCase();
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
 * The leaderboards (P_Leaderboard, P_LeaderboardWeb): pick the game, its setup and the week or all
 * time; the top 3 on a podium in the game's colour, places 4 to 20, and your place.
 */
export function Leaderboards() {
  const [choice, setChoice] = useState<Choice | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address is read in the browser
    setChoice(fromAddress());
  }, []);
  if (!choice) return <Header />;
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

function Header({ period }: { period?: Period }) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="m-0 text-[32px] leading-[1.1] font-black laptop:text-[42px]">Leaderboards</h1>
      <p className="m-0 hidden text-base text-ink2 laptop:block">Each player’s best score counts once. Ties go to the quicker player.</p>
      {period && <span className="sr-only">{PERIOD_LABELS[period]}</span>}
    </header>
  );
}

function Boards({ choice, onChoose }: { choice: Choice; onChoose: (c: Partial<Choice>) => void }) {
  const { offline } = usePlay();
  const entry = gameBySlug(choice.game)!;
  const { view, status, reload } = useBoard(choice.game, choice.setup, choice.period);
  const unit = choice.game === "kana" ? "kana" : "answer";
  const top = view?.top ?? [];
  const you = view?.me ?? top.find((p) => p.you) ?? null;
  const empty = view !== null && top.length === 0;
  const state: PodiumState = !view ? (status === "loading" ? "loading" : "stale") : status === "error" || offline ? "stale" : empty ? "empty" : "ready";
  const setupLabel = entry.setups.find((s) => s.key === choice.setup)?.label ?? "";
  const modes = entry.modes;
  const mode = entry.setups.find((s) => s.key === choice.setup)?.mode ?? modes[0]?.key;

  return (
    <div style={hueStyle(choice.game)} className="flex flex-col gap-3.5 laptop:gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Header />
        <Segmented value={choice.period} onChoose={(period) => onChoose({ period })} className="w-full laptop:w-[300px]" />
      </div>

      <div role="radiogroup" aria-label="Game" className="-mx-4 flex gap-2.5 overflow-x-auto px-4 py-1 [scrollbar-width:none] laptop:mx-0 laptop:grid laptop:grid-cols-7 laptop:gap-3 laptop:overflow-visible laptop:px-0">
        {CATALOG.map((g) => {
          const on = g.slug === choice.game;
          const live = isLive(g.slug);
          return (
            <button
              key={g.slug}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!live}
              onClick={() => onChoose({ game: g.slug })}
              style={hueStyle(g.slug)}
              className={`flex w-[74px] shrink-0 flex-col items-center gap-1 rounded-[20px] px-1 pt-2.5 pb-2 laptop:w-auto laptop:rounded-[22px] laptop:pt-3.5 laptop:pb-3 ${
                on ? "bg-hue text-hue-tint" : "bg-hue-tint text-hue"
              } disabled:opacity-55`}
            >
              <span lang="ja" aria-hidden="true" className="font-card text-[28px] leading-[1.1] font-black laptop:text-4xl">
                {g.glyph}
              </span>
              <span className="text-center text-[11px] leading-[1.2] font-bold laptop:text-[13px] laptop:font-black">
                <span className="laptop:hidden">{g.short}</span>
                <span className="hidden laptop:inline">{g.name}</span>
                {!live && <span className="block font-medium">Soon</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3.5 laptop:grid laptop:grid-cols-[minmax(0,440px)_minmax(0,1fr)] laptop:items-start laptop:gap-6">
        <div className="flex flex-col gap-3.5 laptop:gap-4">
          {modes.length > 1 && (
            <div role="radiogroup" aria-label="How to play" className="grid grid-cols-2 gap-1 rounded-btn bg-surface2 p-[5px]">
              {modes.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={m.key === mode}
                  onClick={() => {
                    const same = entry.setups.find((s) => s.mode === m.key && rest(s.label) === rest(setupLabel));
                    onChoose({ setup: (same ?? entry.setups.find((s) => s.mode === m.key)!).key });
                  }}
                  className={`min-h-[42px] rounded-btn text-sm ${m.key === mode ? "bg-surface font-black text-ink shadow-card" : "font-medium text-ink2"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
          <div role="radiogroup" aria-label="Setup" className="flex flex-wrap gap-2">
            {entry.setups
              .filter((s) => s.mode === mode)
              .map((s) => {
                const on = s.key === choice.setup;
                return (
                  <button
                    key={s.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onChoose({ setup: s.key })}
                    className={`min-h-11 rounded-btn border-2 bg-surface px-3.5 text-[13.5px] ${on ? "border-ink font-black text-ink" : "border-line font-medium text-ink2"}`}
                  >
                    {modes.length > 1 ? rest(s.label) : s.label}
                  </button>
                );
              })}
          </div>
          <section aria-label={`${entry.name} · ${setupLabel}`} className="flex flex-col gap-3 rounded-game bg-hue-tint px-3.5 pt-[18px] laptop:px-[18px] laptop:pt-[22px]">
            <p className="m-0 text-center text-[12.5px] font-black text-hue">
              {choice.period === "week" ? `${weekLabel()} · ${empty ? "STARTED THIS WEEK" : "NEW WEEK ON MONDAY"}` : "ALL TIME · BEST SCORE PER PLAYER"}
            </p>
            {!view && status === "error" ? (
              <div className="pb-4">
                <CouldNotLoad onRetry={() => void reload()} />
              </div>
            ) : (
              <Podium top={top} size="lg" state={state} />
            )}
          </section>
          {you && <YouBar place={you.place} name={you.name} line={placeLine(you, unit)} score={you.score} className="hidden laptop:flex" />}
        </div>

        {empty ? (
          <section className="flex flex-col items-center gap-2 rounded-game bg-surface p-5 text-center shadow-card">
            <h2 className="m-0 text-xl font-black">No scores yet {choice.period === "week" ? "this week" : ""}</h2>
            <p className="m-0 text-sm leading-normal text-ink2">
              {choice.period === "week" ? "The board starts fresh every Monday." : "Nobody has played this one yet."} Play {setupLabel} now and you’re first.
            </p>
            <Link href={`${entry.href}?setup=${encodeURIComponent(choice.setup)}`} className="mt-1.5 inline-flex min-h-14 items-center gap-2 rounded-btn bg-accent px-7 text-[17px] font-black text-on-accent no-underline">
              <PlayTriangle />
              Play and be first
            </Link>
            {choice.period === "week" && (
              <button type="button" onClick={() => onChoose({ period: "all" })} className="min-h-11 text-sm font-bold text-accent">
                See all time instead
              </button>
            )}
          </section>
        ) : top.length > 0 && top.length <= 3 ? (
          <p className="m-0 rounded-game border-2 border-dashed border-line p-5 text-center text-sm leading-normal text-ink2">
            {top.length === 1 ? "Only one player" : `Only ${top.length} players`} on this board so far. Places 4 to 20 show here.
          </p>
        ) : (
          top.length > 3 && (
            <ol start={4} className="m-0 flex list-none flex-col rounded-game bg-surface p-1.5 shadow-card laptop:grid laptop:grid-flow-col laptop:grid-cols-2 laptop:grid-rows-9 laptop:gap-x-2">
              {top.slice(3).map((p) => (
                <BoardRowView key={p.place} p={p} unit={unit} />
              ))}
            </ol>
          )
        )}
      </div>
      {you && (
        <YouBar
          place={you.place}
          name={you.name}
          line={placeLine(you, unit)}
          score={you.score}
          className="fixed inset-x-3 bottom-[max(14px,env(safe-area-inset-bottom))] z-30 flex laptop:hidden"
        />
      )}
      {you && <div aria-hidden="true" className="h-16 laptop:hidden" />}
    </div>
  );
}

function YouBar({ place, name, line, score, className }: { place: number; name: string; line: string; score: number; className: string }) {
  return (
    <section aria-label="Your place" className={`items-center gap-3 rounded-[22px] bg-ink px-4 py-2.5 text-page shadow-[0_12px_32px_var(--shadow)] ${className}`}>
      <span className="text-sm font-black">{ordinal(place)}</span>
      <Avatar name={name} size={34} />
      <span className="flex min-w-0 flex-auto flex-col">
        <span className="truncate text-[15px] font-black">
          You · <PlayerName name={name} />
        </span>
        <span className="text-xs opacity-80">{line}</span>
      </span>
      <span className="text-xl font-black">{score}</span>
    </section>
  );
}

function Segmented({ value, onChoose, className }: { value: Period; onChoose: (p: Period) => void; className: string }) {
  return (
    <div role="radiogroup" aria-label="When" className={`grid grid-cols-2 gap-1 rounded-btn bg-surface2 p-[5px] ${className}`}>
      {PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={p === value}
          onClick={() => onChoose(p)}
          className={`min-h-[42px] rounded-btn text-sm ${p === value ? "bg-surface font-black text-ink shadow-card" : "font-medium text-ink2"}`}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  );
}
