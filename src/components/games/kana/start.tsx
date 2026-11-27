"use client";

import { useEffect } from "react";

import { Switch } from "@/components/cards/switch";
import { PageHeader } from "@/components/ui/page";
import { ALL_KANA, kanaFor } from "@/lib/games/kana/content";
import {
  GROUP_LABELS,
  GROUPS,
  type GameSettings,
  type Group,
  LENGTHS,
  MODE_LABELS,
  MODES,
  type Script,
  WEAKEST_COUNT,
} from "@/lib/games/kana/types";
import { WEAK_BELOW } from "@/lib/games/progress";

import { Field, Segmented, WaitingChip } from "../parts";
import { ProgressPanel } from "../progress-panel";
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
  settings,
  update,
  history,
  loading,
  waiting,
  onStart,
}: {
  settings: GameSettings;
  update: (patch: Partial<GameSettings>) => void;
  history: History;
  /** Still finding out who's playing. */
  loading: boolean;
  waiting: number;
  onStart: (weakest: boolean) => void;
}) {
  const weakest = history[settings.mode].weakest;
  const pool = kanaFor(ALL_KANA, settings.scripts, settings.groups);
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
      <PageHeader title="Kana game" sub="Read a kana and type it, or hear it and find it." />

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
            <WaitingChip waiting={waiting} />
          </div>
          <p className="m-0 hidden text-[12.5px] text-ink2 laptop:block">Enter starts. In a game, Esc stops.</p>
        </section>

        {loading ? (
          <div aria-label="Loading" className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-card">
            <span className="h-3 w-[55%] rounded-full bg-surface2" />
            <span className="h-2.5 w-[85%] rounded-full bg-surface2" />
            <span className="h-2.5 w-[70%] rounded-full bg-surface2" />
          </div>
        ) : (
          <ProgressPanel
            label={MODE_LABELS[settings.mode]}
            runs={history[settings.mode].games}
            weak={weakest
              .filter((w) => w.strength < WEAK_BELOW)
              .slice(0, 12)
              .map((w) => ({ key: w.item, face: w.kana.kana, answer: w.kana.romaji, seen: w.seen, right: w.right }))}
            unit="kana"
            scoreNote={SCORE_NOTE}
          />
        )}
      </div>
    </div>
  );
}

const GROUP_SAMPLE: Record<Group, string> = { basic: "か", dakuten: "が", combo: "きゃ", extended: "ファ" };

const SCORE_NOTE =
  "Each kana scores up to 100: 70 for right first time, and up to 30 more for answering within 1.5 seconds (none after 5). A game's score is the average. A miss comes back a few cards later until it's right.";
