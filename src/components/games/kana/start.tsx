"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Switch } from "@/components/cards/switch";
import { PLAY_ICONS, PlayIcon, PlayTriangle } from "@/components/play/bits";
import { BoardCard } from "@/components/play/board-card";
import { hueStyle } from "@/lib/games/catalog";
import { ALL_KANA, kanaFor } from "@/lib/games/kana/content";
import { KANA_SETUPS, setupKey } from "@/lib/games/kana/setups";
import { GROUP_LABELS, GROUPS, type GameSettings, type Group, LENGTHS, MODE_LABELS, type Mode, type Script, WEAKEST_COUNT } from "@/lib/games/kana/types";
import { WEAK_BELOW } from "@/lib/games/progress";

import { Field, Segmented, WaitingChip } from "../parts";
import { ProgressPanel } from "../progress-panel";
import type { History } from "./kana-game";

const MODES_SHOWN: { mode: Mode; from: string; to: string; note: string }[] = [
  { mode: "read", from: "か", to: "ka", note: "See a kana, type how it sounds." },
  { mode: "find", from: "ka", to: "か", note: "Hear a sound, tap its kana." },
];

const SCRIPT_CHOICES: [string, string, Script[]][] = [
  ["hiragana", "Hiragana", ["hiragana"]],
  ["katakana", "Katakana", ["katakana"]],
  ["both", "Both", ["hiragana", "katakana"]],
];

/** Weakest needs this many kana seen before it's worth a game. */
const WEAKEST_MIN = 4;

const isKana = (s: string) => /[ぁ-ゖァ-ヺ]/.test(s);

/** The standard setup nearest the one picked: the same way to play, Basic · 20 for one script, or Both · All · 50. */
function nearestStandard(settings: GameSettings): { patch: Partial<GameSettings>; key: string } {
  if (settings.scripts.length === 2) return { patch: { groups: [...GROUPS], length: 50 }, key: setupKey(settings.mode, settings.scripts, GROUPS, 50) };
  return { patch: { groups: ["basic"], length: 20 }, key: setupKey(settings.mode, settings.scripts, ["basic"], 20) };
}

/**
 * The kana game's start screen in the play look (P_StartBoard, P_KanaSetup): a header in the
 * game's colour, how to play as two picture cards, the script, kana and length, a big Play,
 * this week's board for the setup picked, and the player's progress.
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
  const count = settings.length > 0 ? Math.min(settings.length, pool.length) : pool.length;
  const katakana = settings.scripts.includes("katakana");
  const scriptValue = settings.scripts.length === 2 ? "both" : settings.scripts[0];
  const canWeakest = weakest.length >= WEAKEST_MIN;
  const weakCount = Math.min(WEAKEST_COUNT, weakest.length);
  const key = count > 0 ? setupKey(settings.mode, settings.scripts, settings.groups, count) : null;
  const standard = KANA_SETUPS.find((s) => s.key === key) ?? null;
  const nearest = nearestStandard(settings);
  const nearestLabel = KANA_SETUPS.find((s) => s.key === nearest.key)?.label.split(" · ").slice(1).join(" · ") ?? null;

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

  return (
    <div style={hueStyle("kana")} className="flex flex-col gap-4 laptop:gap-5">
      <header className="relative flex flex-col gap-1 overflow-hidden rounded-game bg-hue-tint px-[18px] pt-3.5 pb-5 laptop:px-7 laptop:pt-[18px] laptop:pb-[26px]">
        <span lang="ja" aria-hidden="true" className="absolute right-0 -bottom-11 font-card text-[170px] leading-none font-black text-hue opacity-20 laptop:right-10 laptop:-bottom-[70px] laptop:text-[240px]">
          か
        </span>
        <Link href="/play" className="-ml-1.5 inline-flex min-h-10 items-center gap-0.5 self-start text-sm font-bold text-hue no-underline">
          <PlayIcon d={PLAY_ICONS.back} size={18} stroke={2.2} />
          All games
        </Link>
        <h1 className="relative m-0 text-[34px] leading-[1.05] font-black laptop:text-[44px]">Kana game</h1>
        <p className="relative m-0 max-w-[240px] text-sm leading-[1.45] text-ink2 laptop:max-w-none laptop:text-base">
          Read a kana and type it, or hear it and find it.<span className="hidden laptop:inline"> Enter starts; Esc stops.</span>
        </p>
      </header>

      <div className="flex flex-col gap-4 laptop:grid laptop:grid-cols-[minmax(0,440px)_minmax(0,1fr)] laptop:items-start laptop:gap-6">
        <section aria-label="Game settings" className="flex flex-col gap-[18px] laptop:sticky laptop:top-7 laptop:rounded-game laptop:bg-surface laptop:p-[22px] laptop:shadow-card">
          <div role="radiogroup" aria-label="How to play" className="grid grid-cols-2 gap-2.5">
            {MODES_SHOWN.map((m) => {
              const on = settings.mode === m.mode;
              return (
                <button
                  key={m.mode}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => update({ mode: m.mode })}
                  className={`relative flex flex-col gap-1.5 rounded-[20px] border-2 p-3.5 text-left ${on ? "border-hue bg-hue-tint" : "border-line bg-surface"}`}
                >
                  <span aria-hidden="true" className="text-[22px] font-black">
                    <span lang={isKana(m.from) ? "ja" : undefined} className={isKana(m.from) ? "font-card" : ""}>
                      {m.from}
                    </span>{" "}
                    <span className="text-base text-ink2">→</span>{" "}
                    <span lang={isKana(m.to) ? "ja" : undefined} className={isKana(m.to) ? "font-card" : ""}>
                      {m.to}
                    </span>
                  </span>
                  <span className="text-base font-black">{MODE_LABELS[m.mode]}</span>
                  <span className="text-[12.5px] leading-[1.4] text-ink2">{m.note}</span>
                  {on && (
                    <span aria-hidden="true" className="absolute top-3 right-3 inline-flex size-[22px] items-center justify-center rounded-full bg-hue text-hue-tint">
                      <PlayIcon d={PLAY_ICONS.check} size={14} stroke={2.8} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <Field label="Script">
            <Segmented
              name="script"
              legend="Script"
              value={scriptValue}
              options={SCRIPT_CHOICES.map(([v, l]) => [v, l] as const)}
              onChoose={(v) => update({ scripts: SCRIPT_CHOICES.find(([x]) => x === v)![2] })}
            />
          </Field>
          <Field label="Kana" note={katakana ? undefined : "Extended sounds are katakana only."}>
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
                    className={`inline-flex min-h-11 items-center gap-[7px] rounded-btn border-2 px-3.5 text-sm disabled:opacity-45 ${
                      on && !disabled ? "border-hue bg-hue-tint font-black text-ink" : "border-line bg-surface font-medium text-ink2"
                    }`}
                  >
                    {GROUP_LABELS[g]}
                    <span lang="ja" className="font-card text-[17px] font-bold">
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
          <button
            type="button"
            disabled={count === 0}
            onClick={() => onStart(false)}
            className="inline-flex min-h-[62px] items-center justify-center gap-2.5 rounded-btn bg-accent text-[19px] font-black text-on-accent shadow-[0_10px_28px_var(--glow)] disabled:opacity-45"
          >
            {count > 0 && <PlayTriangle size={20} />}
            {count === 0 ? "Pick some kana to start" : `Play · ${count} kana`}
          </button>
          <div className="-mt-1.5 flex flex-wrap items-center justify-between gap-2.5">
            <button type="button" disabled={!canWeakest} onClick={() => onStart(true)} className="min-h-11 text-left text-sm font-bold disabled:font-medium disabled:text-ink2">
              {canWeakest ? `Practise my weakest ${weakCount} →` : "Your weakest kana show up after a game or two."}
            </button>
            <span className="inline-flex items-center gap-2 text-[13px] font-bold text-ink2">
              Tones
              <Switch checked={settings.tones} onChange={(on) => update({ tones: on })} label="Tones" />
            </span>
          </div>
          <WaitingChip waiting={waiting} />
        </section>

        <div className="flex flex-col gap-4">
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
      </div>
    </div>
  );
}

const GROUP_SAMPLE: Record<Group, string> = { basic: "か", dakuten: "が", combo: "きゃ", extended: "ファ" };

const SCORE_NOTE =
  "Each kana scores up to 100: 70 for right first time, and up to 30 more for answering within 1.5 seconds (none after 5). A game's score is the average. A miss comes back a few cards later until it's right. Only full games of the standard setups go on the boards; weakest-kana games don't.";
