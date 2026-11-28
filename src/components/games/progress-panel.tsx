"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { type PastGame, progressOf, type Window } from "@/lib/games/progress";
import { formatSeconds } from "@/lib/games/score";

import { LineChart, ScoreChart } from "./charts";
import { Tile } from "./parts";

/** One weak item on the start screen: its face (Japanese), its answer, and how it went. */
export type WeakTile = { key: string; face: string; answer: string; seen: number; right: number };

/**
 * A game's progress for one mode: best and last scores, accuracy and speed over the last few
 * runs against the few before, the charts, and the weakest items. `unit` names a card ("kana").
 */
export function ProgressPanel({
  label,
  runs,
  weak,
  unit,
  scoreNote,
}: {
  label: string;
  /** Newest first. */
  runs: PastGame[];
  weak: WeakTile[];
  unit: string;
  scoreNote: React.ReactNode;
}) {
  const p = progressOf(runs);
  const note = <p className="m-0 max-w-130 text-meta text-ink2">{scoreNote}</p>;
  if (p.games === 0) {
    return (
      <div className="flex flex-col gap-3">
        <EmptyState>
          No {label} games yet. After your first, your best and recent scores, accuracy, speed and the {unit} you find hardest
          show here.
        </EmptyState>
        {note}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <section aria-label={`${label} progress`} className="flex flex-col gap-3 rounded-card border-[1.5px] border-line bg-surface p-4 shadow-card">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="m-0 text-lead font-black">{label} · your games</h2>
          <p className="m-0 text-meta text-ink2">{p.games === 1 ? "1 game" : `${p.games} games`}</p>
        </div>
        <dl className="m-0 grid grid-cols-2 gap-2 wide:grid-cols-4">
          <Tile label="Best score" value={String(p.best?.score ?? "–")} />
          <Tile label="Last game" value={String(p.last?.score ?? "–")} />
          <Tile label="Right first time" value={p.recent ? `${p.recent.accuracy}%` : "–"} note={compareAccuracy(p.recent, p.before)} />
          <Tile label={`Per ${unit}`} value={p.recent?.meanMs ? formatSeconds(p.recent.meanMs) : "–"} note={compareSpeed(p.recent, p.before)} />
        </dl>
        <p className="m-0 text-meta text-ink2">
          Right first time and speed are over your last {p.recent?.games === 1 ? "game" : `${p.recent?.games} games`}
          {p.before ? `, against the ${p.before.games === 1 ? "game" : `${p.before.games}`} before.` : "."}
        </p>
        <div className="flex flex-col gap-1.5">
          <h3 className="m-0 text-meta font-bold">Score per game</h3>
          <ScoreChart games={p.chart} />
        </div>
        <div className="grid gap-3 wide:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <h3 className="m-0 text-meta font-bold">Right first time</h3>
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
            <h3 className="m-0 text-meta font-bold">Seconds per {unit}</h3>
            <LineChart
              games={p.chart}
              value={(g) => (g.meanMs === null ? null : g.meanMs / 1000)}
              max={speedMax(p.chart)}
              ticks={speedTicks(p.chart)}
              format={(v) => `${Number.isInteger(v) ? v : v.toFixed(1)} s`}
              label={`Seconds per ${unit} per game, oldest first: ${p.chart.map((g) => (g.meanMs === null ? "none" : (g.meanMs / 1000).toFixed(1))).join(", ")}. Lower is faster.`}
            />
          </div>
        </div>
        <p className="m-0 text-caption text-ink2">Oldest on the left, your last game on the right. Lower seconds is faster.</p>
      </section>

      <section aria-label={`Weakest ${unit}`} className="flex flex-col gap-2.5 rounded-card border-[1.5px] border-line bg-surface p-4 shadow-card">
        <h2 className="m-0 text-lead font-black">Weakest {unit}</h2>
        {weak.length === 0 ? (
          <p className="m-0 text-meta text-ink2">None stand out: everything you&apos;ve played lately was right first time and quick.</p>
        ) : (
          <>
            <p className="m-0 text-meta text-ink2">Missed or slow over their last few {label} answers, weakest first.</p>
            <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0 min-[420px]:grid-cols-4 wide:grid-cols-6">
              {weak.map((w) => (
                <li key={w.key} className="flex flex-col items-center gap-0.5 rounded-btn bg-surface2 px-1 py-2">
                  <span lang="ja" className="font-ja text-title">
                    {w.face}
                  </span>
                  <span className="text-meta font-bold">{w.answer}</span>
                  <span className="text-caption text-ink2">{w.right === w.seen ? "right, but slow" : `${w.right} of ${w.seen} right`}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      {note}
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
