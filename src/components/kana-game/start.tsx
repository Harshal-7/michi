"use client";

import { useEffect } from "react";

import { Switch } from "@/components/cards/switch";
import { BackLink } from "@/components/learn/tabs";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { kanaFor } from "@/lib/kana-game/game";
import { progressOf, type Strength, WEAK_BELOW, type Window } from "@/lib/kana-game/progress";
import { formatSeconds } from "@/lib/kana-game/score";
import {
  GROUP_LABELS,
  GROUPS,
  type GameKana,
  type GameSettings,
  type Group,
  LENGTHS,
  MODE_LABELS,
  MODES,
  type Script,
  WEAKEST_COUNT,
} from "@/lib/kana-game/types";
import { ROUTES } from "@/lib/planner/day-plan";

import { LineChart, ScoreChart } from "./charts";
import type { History } from "./kana-game";

const MODE_NOTES = {
  read: "See a kana and type its romaji.",
  find: "See and hear the romaji, then pick its kana.",
} as const;

const SCRIPT_CHOICES: [string, string, Script[]][] = [
  ["hiragana", "Hiragana", ["hiragana"]],
  ["katakana", "Katakana", ["katakana"]],
  ["both", "Both", ["hiragana", "katakana"]],
];

/** Weakest needs this many kana seen before it's worth a game. */
const WEAKEST_MIN = 4;

export function StartScreen({
  kana,
  settings,
  update,
  history,
  weakest,
  waiting,
  onStart,
}: {
  kana: GameKana[];
  settings: GameSettings;
  update: (patch: Partial<GameSettings>) => void;
  history: History;
  weakest: (Strength & { kana: GameKana })[];
  waiting: number;
  onStart: (weakest: boolean) => void;
}) {
  const pool = kanaFor(kana, settings.scripts, settings.groups);
  const count = settings.length > 0 ? Math.min(settings.length, pool.length) : pool.length;
  const katakana = settings.scripts.includes("katakana");
  const scriptValue = settings.scripts.length === 2 ? "both" : settings.scripts[0];
  const canWeakest = weakest.length >= WEAKEST_MIN;
  const weakCount = Math.min(WEAKEST_COUNT, weakest.length);

  // Enter starts the game from anywhere on the page but a control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (e.key !== "Enter" || e.repeat || target?.closest("button, a, input:not([type=radio])")) return;
      if (count > 0) onStart(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, onStart]);

  const toggleGroup = (g: Group) => {
    const groups = settings.groups.includes(g) ? settings.groups.filter((x) => x !== g) : GROUPS.filter((x) => x === g || settings.groups.includes(x));
    update({ groups });
  };

  return (
    <div data-wide className="mx-auto flex w-full max-w-[720px] flex-col gap-3 laptop:max-w-none">
      <div className="flex flex-col gap-3">
        <BackLink href={ROUTES.learn}>Learn</BackLink>
        <PageHeader title="Kana game" sub="Practice on the side: it doesn't change your reviews." />
      </div>

      <div className="flex flex-col gap-3 laptop:grid laptop:grid-cols-[minmax(0,400px)_minmax(0,1fr)] laptop:items-start laptop:gap-6">
        <section aria-label="Game settings" className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-card laptop:sticky laptop:top-7">
          <Field label="How to play" note={MODE_NOTES[settings.mode]}>
            <Segmented
              name="mode"
              legend="How to play"
              value={settings.mode}
              options={MODES.map((m) => [m, MODE_LABELS[m]] as const)}
              onChoose={(v) => update({ mode: v as GameSettings["mode"] })}
            />
          </Field>
          <Field label="Script">
            <Segmented
              name="script"
              legend="Script"
              value={scriptValue}
              options={SCRIPT_CHOICES.map(([v, l]) => [v, l] as const)}
              onChoose={(v) => update({ scripts: SCRIPT_CHOICES.find(([x]) => x === v)![2] })}
            />
          </Field>
          <Field label="Groups" note={katakana ? undefined : "Extended sounds are katakana only."}>
            <div className="flex flex-wrap gap-2">
              {GROUPS.map((g) => {
                const on = settings.groups.includes(g);
                const disabled = g === "extended" && !katakana;
                return (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={on}
                    disabled={disabled}
                    onClick={() => toggleGroup(g)}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-btn border px-3.5 text-[13.5px] disabled:opacity-45 ${
                      on && !disabled ? "border-accent bg-accent-soft font-bold text-ink" : "border-line bg-surface font-medium text-ink2"
                    }`}
                  >
                    {GROUP_LABELS[g]}
                    <span lang="ja" className="font-card text-[15px] font-semibold">
                      {GROUP_SAMPLE[g]}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="How many">
            <Segmented
              name="length"
              legend="How many"
              value={String(settings.length)}
              options={LENGTHS.map((l) => [String(l), l === 0 ? `All ${pool.length}` : String(l)] as const)}
              onChoose={(v) => update({ length: Number(v) as GameSettings["length"] })}
            />
          </Field>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <p className="m-0 text-[13px] font-bold">Tones</p>
              <p className="m-0 text-[12.5px] text-ink2">A soft sound for right and missed answers.</p>
            </div>
            <Switch checked={settings.tones} onChange={(on) => update({ tones: on })} label="Tones" />
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={count === 0}
              onClick={() => onStart(false)}
              className="min-h-14 rounded-btn bg-accent text-[17px] font-bold text-on-accent disabled:opacity-45"
            >
              {count === 0 ? "Pick a group to start" : `Start · ${count} kana`}
            </button>
            <button
              type="button"
              disabled={!canWeakest}
              onClick={() => onStart(true)}
              className="min-h-[50px] rounded-btn border border-line bg-surface text-[15px] font-bold disabled:opacity-45"
            >
              Practise your weakest {canWeakest ? weakCount : WEAKEST_COUNT}
            </button>
            {!canWeakest && <p className="m-0 text-center text-[12.5px] text-ink2">Your weakest kana show up after a game or two.</p>}
            {waiting > 0 && (
              <p role="status" className="m-0 self-start rounded-full border border-warn bg-surface px-3 py-1.5 text-[12.5px] font-bold text-warn">
                {waiting === 1 ? "1 game" : `${waiting} games`} waiting to save
              </p>
            )}
          </div>
          <p className="m-0 hidden text-[12.5px] text-ink2 laptop:block">Enter starts. In a game, Esc stops.</p>
        </section>

        <ProgressPanel history={history} mode={settings.mode} weakest={weakest} />
      </div>
    </div>
  );
}

const GROUP_SAMPLE: Record<Group, string> = { basic: "か", dakuten: "が", combo: "きゃ", extended: "ファ" };

function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[13px] font-bold">{label}</p>
      {children}
      {note && <p className="m-0 text-[12.5px] text-ink2">{note}</p>}
    </div>
  );
}

/** The segmented control from Settings: equal segments in a `--surface2` track. */
function Segmented({
  name,
  legend,
  value,
  options,
  onChoose,
}: {
  name: string;
  legend: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChoose: (value: string) => void;
}) {
  return (
    <fieldset className="m-0 border-none p-0">
      <legend className="sr-only">{legend}</legend>
      <div className="grid gap-1 rounded-btn bg-surface2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(([v, text]) => (
          <label
            key={v}
            className="relative inline-flex min-h-10 cursor-pointer items-center justify-center rounded-btn px-2 text-[13.5px] font-medium text-ink2 has-[:checked]:bg-surface has-[:checked]:font-bold has-[:checked]:text-ink has-[:checked]:shadow-card has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
          >
            <input type="radio" name={name} value={v} checked={v === value} onChange={() => onChoose(v)} className="sr-only" />
            {text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ProgressPanel({ history, mode, weakest }: { history: History; mode: GameSettings["mode"]; weakest: (Strength & { kana: GameKana })[] }) {
  const p = progressOf(history[mode].games);
  const weak = weakest.filter((w) => w.strength < WEAK_BELOW).slice(0, 12);
  if (p.games === 0) {
    return (
      <div className="flex flex-col gap-3">
        <EmptyState>
          No {MODE_LABELS[mode]} games yet. After your first, your best and recent scores, accuracy, speed and the kana you
          find hardest show here.
        </EmptyState>
        <ScoreNote />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <section aria-label={`${MODE_LABELS[mode]} progress`} className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="m-0 text-[15px] font-bold">{MODE_LABELS[mode]} · your games</h2>
          <p className="m-0 text-[12.5px] text-ink2">{p.games === 1 ? "1 game" : `${p.games} games`}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 wide:grid-cols-4">
          <Tile label="Best score" value={String(p.best?.score ?? "–")} />
          <Tile label="Last game" value={String(p.last?.score ?? "–")} />
          <Tile label="Right first time" value={p.recent ? `${p.recent.accuracy}%` : "–"} note={compareAccuracy(p.recent, p.before)} />
          <Tile label="Per kana" value={p.recent?.meanMs ? formatSeconds(p.recent.meanMs) : "–"} note={compareSpeed(p.recent, p.before)} />
        </div>
        <p className="m-0 text-[12.5px] text-ink2">
          Right first time and speed are over your last {p.recent?.games === 1 ? "game" : `${p.recent?.games} games`}
          {p.before ? `, against the ${p.before.games === 1 ? "game" : `${p.before.games}`} before.` : "."}
        </p>
        <div className="flex flex-col gap-1.5">
          <h3 className="m-0 text-[13px] font-bold">Score per game</h3>
          <ScoreChart games={p.chart} />
        </div>
        <div className="grid gap-3 wide:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <h3 className="m-0 text-[13px] font-bold">Right first time</h3>
            <LineChart
              games={p.chart}
              value={(g) => (g.cards ? Math.round((g.firstTryRight / g.cards) * 100) : null)}
              max={100}
              ticks={[100, 50, 0]}
              format={(v) => `${v}%`}
              label={`Right first time per game, oldest first: ${p.chart.map((g) => (g.cards ? `${Math.round((g.firstTryRight / g.cards) * 100)}%` : "none")).join(", ")}.`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className="m-0 text-[13px] font-bold">Seconds per kana</h3>
            <LineChart
              games={p.chart}
              value={(g) => (g.meanMs === null ? null : g.meanMs / 1000)}
              max={speedMax(p.chart)}
              ticks={speedTicks(p.chart)}
              format={(v) => `${Number.isInteger(v) ? v : v.toFixed(1)} s`}
              label={`Seconds per kana per game, oldest first: ${p.chart.map((g) => (g.meanMs === null ? "none" : (g.meanMs / 1000).toFixed(1))).join(", ")}. Lower is faster.`}
            />
          </div>
        </div>
        <p className="m-0 text-xs text-ink2">Oldest on the left, your last game on the right. Lower seconds is faster.</p>
      </section>

      <section aria-label="Weakest kana" className="flex flex-col gap-2.5 rounded-card bg-surface p-4 shadow-card">
        <h2 className="m-0 text-[15px] font-bold">Weakest kana</h2>
        {weak.length === 0 ? (
          <p className="m-0 text-[13px] text-ink2">None stand out: everything you&apos;ve played lately was right first time and quick.</p>
        ) : (
          <>
            <p className="m-0 text-[12.5px] text-ink2">Missed or slow over their last few {MODE_LABELS[mode]} answers, weakest first.</p>
            <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0 min-[420px]:grid-cols-4 wide:grid-cols-6">
              {weak.map((w) => (
                <li key={w.itemId} className="flex flex-col items-center gap-0.5 rounded-[14px] bg-surface2 px-1 py-2">
                  <span lang="ja" className="font-card text-[24px] leading-[1.2] font-semibold">
                    {w.kana.kana}
                  </span>
                  <span className="text-[12.5px] font-semibold">{w.kana.romaji}</span>
                  <span className="text-[11px] text-ink2">{w.right === w.seen ? "right, but slow" : `${w.right} of ${w.seen} right`}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <ScoreNote />
    </div>
  );
}

function ScoreNote() {
  return (
    <p className="m-0 text-[12.5px] leading-normal text-ink2">
      Each kana scores up to 100: 70 for right first time, and up to 30 more for answering within 1.5 seconds (none after 5).
      A game&apos;s score is the average. A miss comes back a few cards later until it&apos;s right.
    </p>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-[14px] bg-surface2 px-1.5 py-2.5 text-center">
      <span className="text-xl font-bold">{value}</span>
      <span className="text-[12.5px] font-bold text-ink2">{label}</span>
      {note && <span className="text-[11px] text-ink2">{note}</span>}
    </div>
  );
}

function compareAccuracy(recent: Window | null, before: Window | null): string | null {
  if (!recent || !before) return null;
  const d = recent.accuracy - before.accuracy;
  return d === 0 ? `same as before` : `${d > 0 ? "up" : "down"} from ${before.accuracy}%`;
}

function compareSpeed(recent: Window | null, before: Window | null): string | null {
  if (!recent?.meanMs || !before?.meanMs) return null;
  const d = Math.round((before.meanMs - recent.meanMs) / 100) / 10;
  return d === 0 ? "same as before" : d > 0 ? `${d.toFixed(1)} s faster` : `${(-d).toFixed(1)} s slower`;
}

/** The speed chart's top: whole seconds above the slowest game, at least 3. */
function speedMax(games: { meanMs: number | null }[]) {
  const slowest = Math.max(0, ...games.map((g) => (g.meanMs ?? 0) / 1000));
  return Math.max(3, Math.ceil(slowest));
}

function speedTicks(games: { meanMs: number | null }[]) {
  const max = speedMax(games);
  return [max, max / 2, 0];
}
