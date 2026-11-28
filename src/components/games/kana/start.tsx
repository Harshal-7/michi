"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { SkeletonText } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { GameGlyph, Kbd, PaperRules } from "@/components/play/bits";
import { BoardCard } from "@/components/play/board-card";
import { ALL_KANA, kanaFor } from "@/lib/games/kana/content";
import { KANA_SETUPS, setupKey } from "@/lib/games/kana/setups";
import { GROUP_LABELS, GROUPS, type GameSettings, type Group, MODE_LABELS, type Mode, type Script, SCRIPTS, WEAKEST_COUNT } from "@/lib/games/kana/types";
import { WEAK_BELOW } from "@/lib/games/progress";

import { Ja, ModeCards, OptionTiles, WaitingChip } from "../parts";
import { ProgressPanel } from "../progress-panel";
import type { History } from "./kana-game";

const MODES_SHOWN: { mode: Mode; note: string }[] = [
  { mode: "read", note: "See a kana, type how it sounds." },
  { mode: "find", note: "Hear a sound, tap its kana. Space says it again." },
];

/** Weakest needs this many kana seen before it's worth a game. */
const WEAKEST_MIN = 4;

/** The standard setup nearest the one picked: the same mode and scripts, basic kana only. */
function nearestStandard(settings: GameSettings): { patch: Partial<GameSettings>; key: string } {
  const groups: Group[] = ["basic"];
  return { patch: { groups }, key: setupKey(settings.mode, settings.scripts, groups, kanaFor(ALL_KANA, settings.scripts, groups).length) };
}

/**
 * The kana game's start screen (RF_PlayKanaStart), the way every game sets up: the cobalt band with
 * the way back, the game mode as two cards, the writing system and kana as tiles, and Start; this
 * week's board for the setup picked, tones, and the player's progress below. A game plays every kana
 * picked. Enter starts.
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
    <div className="mx-auto flex w-full max-w-150 flex-col">
      <section className="relative h-41.5 overflow-hidden rounded-l-box rounded-r-card bg-cover-cobalt px-4.5 py-3.5 text-on-cobalt laptop:h-44 laptop:px-6 laptop:py-4">
        <PaperRules height={176} />
        <Link
          href="/play"
          aria-label="All games"
          className="relative grid size-12 place-items-center rounded-btn bg-on-cobalt/15 text-on-cobalt no-underline hover:bg-on-cobalt/25"
        >
          <Icon name="chevron-left" />
        </Link>
        <span lang="ja" className="absolute top-5.5 right-6 grid size-19 -rotate-8 place-items-center rounded-full bg-snow text-cover-cobalt shadow-raised ring-4 ring-cover-blue">
          <GameGlyph glyph="か" size={60} />
        </span>
        <h1 className="relative m-0 mt-2.5 text-headline font-black tracking-[-0.01em] laptop:text-display">Kana game</h1>
        <p className="relative m-0 mt-1 max-w-[calc(100%-96px)] text-body">Read a kana and type it, or hear it and find it.</p>
      </section>

      <div className="mt-3.5 flex flex-col gap-3">
        <ModeCards
          modes={MODES_SHOWN.map((m) => ({
            key: m.mode,
            label: MODE_LABELS[m.mode],
            note: m.note,
            on: settings.mode === m.mode,
            onPick: () => update({ mode: m.mode }),
            preview: m.mode === "read" ? <Ja>か</Ja> : <span>ka</span>,
          }))}
        />
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

      <Button size="lg" full icon={count > 0 ? "play" : undefined} disabled={count === 0} onClick={() => onStart(false)} className="mt-3.5">
        {count === 0 ? "Pick some kana to start" : `Start · ${count} kana`}
      </Button>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4">
        <button
          type="button"
          disabled={!canWeakest}
          onClick={() => onStart(true)}
          className="inline-flex min-h-11 items-center text-left text-body font-bold text-accent disabled:text-meta disabled:font-medium disabled:text-ink2"
        >
          {canWeakest ? `Practise my weakest ${weakCount}` : "Your weakest kana show up after a game or two."}
        </button>
        <span className="ml-auto flex items-center gap-2 text-meta text-ink2">
          <Kbd>Enter</Kbd>
          starts
        </span>
      </div>
      <WaitingChip waiting={waiting} />

      <div className="mt-1.5">
        <BoardCard
          game="kana"
          setup={standard?.key ?? null}
          label={standard?.label ?? `${MODE_LABELS[settings.mode]} · ${settings.scripts.length === 2 ? "Both" : settings.scripts[0] === "hiragana" ? "Hiragana" : "Katakana"} · ${settings.groups.map((g) => GROUP_LABELS[g]).join(" + ")} · ${count}`}
          nearest={standard || !nearestLabel ? null : { label: nearestLabel, onSwitch: () => update(nearest.patch) }}
        />
      </div>
      <p className="m-0 mt-2.5 text-meta text-ink2">Each kana scores up to 100: 70 for right first time, up to 30 more for a quick answer. A miss comes back a few cards later.</p>
      <div className="mt-3 flex min-h-11 items-center justify-between gap-3 border-y-[1.5px] border-line py-1.5">
        <span className="flex flex-col">
          <span className="text-body font-bold">Tones</span>
          <span className="text-meta text-ink2">A soft sound for right, missed and done.</span>
        </span>
        <Switch checked={settings.tones} onChange={(on) => update({ tones: on })} label="Tones" />
      </div>

      <div className="mt-6">
        {loading ? (
          <Card>
            <SkeletonText lines={3} label="Loading your games" />
          </Card>
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

const SCRIPTS_SHOWN: { script: Script; glyph: string; label: string }[] = [
  { script: "hiragana", glyph: "か", label: "Hiragana" },
  { script: "katakana", glyph: "カ", label: "Katakana" },
];

const GROUP_SAMPLE: Record<Group, string> = { basic: "か", dakuten: "が", combo: "きゃ", extended: "ファ" };

const SCORE_NOTE =
  "The speed points go to answers within 1.5 seconds, none after 5, and a game's score is the average. Only full games of the standard setups go on the boards; weakest-kana games don't.";
