"use client";
// design-lint: legacy

import Link from "next/link";
import { useEffect } from "react";

import { Switch } from "@/components/ui/switch";
import { PLAY_ICONS, PlayIcon, PlayTriangle } from "@/components/play/bits";
import { BoardCard } from "@/components/play/board-card";
import { hueStyle } from "@/lib/games/catalog";
import { ALL_KANA, kanaFor } from "@/lib/games/kana/content";
import { KANA_SETUPS, setupKey } from "@/lib/games/kana/setups";
import { GROUP_LABELS, GROUPS, type GameSettings, type Group, MODE_LABELS, type Mode, type Script, SCRIPTS, WEAKEST_COUNT } from "@/lib/games/kana/types";
import { WEAK_BELOW } from "@/lib/games/progress";

import { Ja, ModeCards, OptionTiles, WaitingChip } from "../parts";
import { ProgressPanel } from "../progress-panel";
import type { History } from "./kana-game";

const MODES_SHOWN: { mode: Mode; note: string }[] = [
  { mode: "read", note: "See a kana, type how it sounds." },
  { mode: "find", note: "Hear a sound, tap its kana." },
];

/** Weakest needs this many kana seen before it's worth a game. */
const WEAKEST_MIN = 4;


/** The standard setup nearest the one picked: the same mode and scripts, basic kana only. */
function nearestStandard(settings: GameSettings): { patch: Partial<GameSettings>; key: string } {
  const groups: Group[] = ["basic"];
  return { patch: { groups }, key: setupKey(settings.mode, settings.scripts, groups, kanaFor(ALL_KANA, settings.scripts, groups).length) };
}

/**
 * The kana game's start screen, the way every game sets up: a small title row, the game mode as
 * two wide cards, the writing system and kana as tiles (side by side on a laptop), and Start,
 * all in view on a laptop; this week's board for the setup picked and the player's progress below.
 * A game plays every kana picked.
 */
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
  // A game plays every kana picked (no "how many").
  const count = pool.length;
  const katakana = settings.scripts.includes("katakana");
  const canWeakest = weakest.length >= WEAKEST_MIN;
  const weakCount = Math.min(WEAKEST_COUNT, weakest.length);
  const key = count > 0 ? setupKey(settings.mode, settings.scripts, settings.groups, count) : null;
  const standard = KANA_SETUPS.find((s) => s.key === key) ?? null;
  const nearest = nearestStandard(settings);
  const nearestLabel = KANA_SETUPS.some((s) => s.key === nearest.key) ? "basic kana only" : null;

  // Enter starts the game from anywhere on the page but a control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (e.key !== "Enter" || e.repeat || target?.closest("button, a, input:not([type=radio]), dialog")) return;
      if (count > 0) onStart(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, onStart]);

  const toggleGroup = (g: Group) => {
    const groups = settings.groups.includes(g) ? settings.groups.filter((x) => x !== g) : GROUPS.filter((x) => x === g || settings.groups.includes(x));
    update({ groups });
  };

  const toggleScript = (x: Script) => {
    const on = settings.scripts.includes(x);
    if (on && settings.scripts.length === 1) return;
    const scripts = on ? settings.scripts.filter((y) => y !== x) : SCRIPTS.filter((y) => y === x || settings.scripts.includes(y));
    // Extended sounds are katakana only: they go when katakana does.
    const groups = scripts.includes("katakana") ? settings.groups : settings.groups.filter((g) => g !== "extended");
    update({ scripts, groups: groups.length ? groups : ["basic"] });
  };

  return (
    <div style={hueStyle("kana")} className="mx-auto flex w-full max-w-[600px] flex-col gap-5 laptop:max-w-[860px] laptop:gap-7">
      <header className="flex items-center gap-3">
        <Link href="/play" aria-label="All games" className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface2 text-ink no-underline">
          <PlayIcon d={PLAY_ICONS.back} size={18} stroke={2.2} />
        </Link>
        <span lang="ja" aria-hidden="true" className="inline-flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-hue-tint font-card text-2xl font-black text-hue">
          か
        </span>
        <div className="flex min-w-0 flex-col">
          <h1 className="m-0 text-[26px] leading-[1.1] font-black laptop:text-[30px]">Kana game</h1>
          <p className="m-0 text-[13px] text-ink2">
            Read a kana and type it, or hear it and find it.<span className="hidden laptop:inline"> Enter starts.</span>
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-5 laptop:gap-6">
        <ModeCards
          modes={MODES_SHOWN.map((m) => ({
            key: m.mode,
            label: MODE_LABELS[m.mode],
            note: m.note,
            on: settings.mode === m.mode,
            onPick: () => update({ mode: m.mode }),
            preview: m.mode === "read" ? <Ja>か</Ja> : <span className="text-xl">ka</span>,
          }))}
        />
        <div className="grid gap-5 laptop:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] laptop:gap-6">
          <OptionTiles
            label="Writing system"
            multi
            options={SCRIPTS_SHOWN.map((x) => ({
              key: x.script,
              label: x.label,
              on: settings.scripts.includes(x.script),
              onPick: () => toggleScript(x.script),
              glyph: <Ja>{x.glyph}</Ja>,
            }))}
          />
          <OptionTiles
            label="Kana"
            multi
            options={GROUPS.filter((g) => g !== "extended" || katakana).map((g) => ({
              key: g,
              label: GROUP_LABELS[g],
              on: settings.groups.includes(g),
              onPick: () => toggleGroup(g),
              glyph: <Ja>{GROUP_SAMPLE[g]}</Ja>,
            }))}
          />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            disabled={count === 0}
            onClick={() => onStart(false)}
            className="inline-flex min-h-[58px] w-full items-center justify-center gap-2.5 rounded-btn bg-accent px-8 text-lg font-black text-on-accent shadow-[0_10px_28px_var(--glow)] disabled:opacity-45 laptop:w-[360px]"
          >
            {count > 0 && <PlayTriangle size={19} />}
            {count === 0 ? "Pick some kana to start" : `Start · ${count} kana`}
          </button>
          <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-1 laptop:w-auto laptop:justify-center">
            <button type="button" disabled={!canWeakest} onClick={() => onStart(true)} className="min-h-11 text-left text-sm font-bold disabled:font-medium disabled:text-ink2">
              {canWeakest ? `Practise my weakest ${weakCount} →` : "Your weakest kana show up after a game or two."}
            </button>
            <span className="inline-flex items-center gap-2 text-[13px] font-bold text-ink2">
              Tones
              <Switch checked={settings.tones} onChange={(on) => update({ tones: on })} label="Tones" />
            </span>
          </div>
          <WaitingChip waiting={waiting} />
        </div>
      </div>

      <BoardCard
        game="kana"
        setup={standard?.key ?? null}
        label={standard?.label ?? `${MODE_LABELS[settings.mode]} · ${settings.scripts.length === 2 ? "Both" : settings.scripts[0] === "hiragana" ? "Hiragana" : "Katakana"} · ${settings.groups.map((g) => GROUP_LABELS[g]).join(" + ")} · ${count}`}
        unit="kana"
        nearest={standard || !nearestLabel ? null : { label: nearestLabel, onSwitch: () => update(nearest.patch) }}
      />
      {loading ? (
        <div aria-label="Loading" className="flex flex-col gap-2 rounded-game bg-surface p-4 shadow-card">
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
  );
}

const SCRIPTS_SHOWN: { script: Script; glyph: string; label: string }[] = [
  { script: "hiragana", glyph: "か", label: "Hiragana" },
  { script: "katakana", glyph: "カ", label: "Katakana" },
];

const GROUP_SAMPLE: Record<Group, string> = { basic: "か", dakuten: "が", combo: "きゃ", extended: "ファ" };

const SCORE_NOTE =
  "Each kana scores up to 100: 70 for right first time, and up to 30 more for answering within 1.5 seconds (none after 5). A game's score is the average. A miss comes back a few cards later until it's right. Only full games of the standard setups go on the boards; weakest-kana games don't.";
