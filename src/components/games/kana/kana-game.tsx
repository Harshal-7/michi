"use client";

import { useMemo, useState } from "react";

import { SessionLoading, useInBrowser } from "@/components/cards/loading";
import { VoiceProvider } from "@/components/cards/voice";
import { ALL_KANA, kanaFor } from "@/lib/games/kana/content";
import { setupKey, weakestKey } from "@/lib/games/kana/setups";
import { type GameKana, type GameSettings, MODE_LABELS, type Mode, type Script, SCRIPTS, WEAKEST_COUNT } from "@/lib/games/kana/types";
import { type PastGame, strengths, weakestFirst, type Strength } from "@/lib/games/progress";
import { bestStreakOf, summarise } from "@/lib/games/score";
import { buildDeck } from "@/lib/games/turns";
import type { GameRun } from "@/lib/games/types";

import { GameDone } from "../done";
import { type Me, usePlayer } from "../use-player";
import { useRunSaver } from "../use-saver";
import { Play, type PlayResult } from "./play";
import { loadSettings, storeSettings } from "./settings";
import { StartScreen } from "./start";

/** A player's past runs and each kana's recent answers, by mode. */
export type History = Record<Mode, { games: PastGame[]; weakest: (Strength & { kana: GameKana })[] }>;

type Phase =
  | { kind: "start" }
  | { kind: "play"; id: string; deck: GameKana[]; weakest: boolean; mode: Mode }
  | { kind: "done"; result: PlayResult; run: GameRun; mode: Mode; weakest: boolean; previousBest: number | null };

const DEFAULT_VOICE = { name: null, rate: 1 };

export type KanaGameProps = {
  /** What "Save your score" shows for a player without a name: the guest sheet, from the play shell. */
  saveScore?: (onSaved: () => void) => React.ReactNode;
};

/**
 * The kana game (inspired by GoKana): pick a way to play and the kana, clear the deck, then see
 * the score. Every kana picked is asked once; a miss shows the answer and comes back later. The
 * kana come from content/generated/kana.json; only the player and their history are fetched.
 */
export function KanaGame(props: KanaGameProps) {
  return useInBrowser() ? <Game {...props} /> : <SessionLoading />;
}

function historyOf(me: Me | null): History {
  const byKey = new Map(ALL_KANA.map((k) => [k.key, k]));
  const of = (mode: Mode) => ({
    games: (me?.runs ?? []).filter((r) => r.setup.startsWith(`${mode}:`)),
    weakest: weakestFirst(strengths((me?.answers ?? []).filter((a) => a.mode === mode)))
      .map((s) => ({ ...s, kana: byKey.get(s.item) }))
      .filter((s): s is Strength & { kana: GameKana } => s.kana !== undefined),
  });
  return { read: of("read"), find: of("find") };
}

/** `?script=katakana` from a chart page. Read in the browser, so the page itself stays static. */
function scriptFromAddress(): Script | null {
  const script = new URLSearchParams(window.location.search).get("script");
  return SCRIPTS.find((s) => s === script) ?? null;
}

function Game({ saveScore }: KanaGameProps) {
  // A chart page links here with its script; everything else is as last time on this device.
  const [settings, setSettings] = useState<GameSettings>(() => {
    const script = scriptFromAddress();
    return { ...loadSettings(), ...(script ? { scripts: [script] } : {}) };
  });
  const [phase, setPhase] = useState<Phase>({ kind: "start" });
  const { me, reload } = usePlayer("kana");
  const saver = useRunSaver(me ? (me.player?.id ?? null) : undefined, () => void reload());
  const history = useMemo(() => historyOf(me), [me]);

  const update = (patch: Partial<GameSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    storeSettings(next);
  };

  const start = (useWeakest: boolean) => {
    const deck = useWeakest
      ? buildDeck(
          history[settings.mode].weakest.slice(0, WEAKEST_COUNT).map((s) => s.kana),
          0,
        )
      : buildDeck(kanaFor(ALL_KANA, settings.scripts, settings.groups), settings.length);
    if (deck.length === 0) return;
    setPhase({ kind: "play", id: crypto.randomUUID(), deck, weakest: useWeakest, mode: settings.mode });
  };

  const finish = (result: PlayResult) => {
    if (phase.kind !== "play") return;
    const answers = result.cards.flatMap((c) =>
      c.first ? [{ item: c.kana.key, right: c.first.right, ms: Math.round(c.first.ms), given: c.first.given.slice(0, 40), tries: Math.max(1, c.tries) }] : [],
    );
    if (answers.length === 0) {
      setPhase({ kind: "start" });
      return;
    }
    const previous = history[phase.mode].games;
    const previousBest = previous.length ? Math.max(...previous.map((g) => g.score)) : null;
    const run: GameRun = {
      id: phase.id,
      game: "kana",
      setup: phase.weakest ? weakestKey(phase.mode, phase.deck.length) : setupKey(phase.mode, settings.scripts, settings.groups, phase.deck.length),
      playedAt: new Date(result.startedAt).toISOString(),
      durationMs: Math.round(result.durationMs),
      answers,
    };
    setPhase({ kind: "done", result, run, mode: phase.mode, weakest: phase.weakest, previousBest });
    void saver.save(run);
  };

  if (phase.kind === "play") {
    return (
      <VoiceProvider prefs={me?.voice ?? DEFAULT_VOICE}>
        <Play
          key={phase.id}
          deck={phase.deck}
          all={optionPool(phase.deck)}
          mode={phase.mode}
          weakest={phase.weakest}
          tones={settings.tones}
          onEnd={finish}
        />
      </VoiceProvider>
    );
  }

  if (phase.kind === "done") {
    const missed = phase.result.cards.filter((c) => c.first && !c.first.right);
    return (
      <GameDone
        kicker={`${phase.weakest ? "Weakest kana" : "Kana game"} · ${MODE_LABELS[phase.mode]}`}
        stopped={phase.result.stopped}
        summary={summarise(phase.run.answers)}
        unit="kana"
        bestStreak={bestStreakOf(phase.run.answers)}
        durationMs={phase.result.durationMs}
        previousBest={phase.previousBest}
        save={saver.status}
        onRetrySave={() => void saver.flush()}
        saveScore={saveScore?.(() => void reload())}
        missed={<Missed missed={missed} mode={phase.mode} stopped={phase.result.stopped} />}
        onAgain={() => start(phase.weakest)}
        onSettings={() => setPhase({ kind: "start" })}
        footnote={me?.player?.isOwner ? "The game's minutes count as study time in This week. Your reviews stay as they were." : null}
      />
    );
  }

  return (
    <StartScreen
      settings={settings}
      update={update}
      history={history}
      loading={me === null}
      waiting={saver.status.waiting}
      onStart={start}
    />
  );
}

function Missed({ missed, mode, stopped }: { missed: PlayResult["cards"]; mode: Mode; stopped: boolean }) {
  if (missed.length === 0) {
    return stopped ? null : (
      <section className="rounded-card bg-surface px-4 py-3 shadow-card">
        <p className="m-0 text-sm">Every kana right on the first try.</p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-2.5 rounded-card bg-surface p-4 shadow-card">
      <h2 className="m-0 text-[15px] font-bold">Missed on the first try</h2>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {missed.map((c) => (
          <li key={c.kana.key} className="inline-flex items-baseline gap-1.5 rounded-full border border-again px-2.5 py-[5px] text-[13px] text-again">
            <span lang="ja" className="font-card text-base font-semibold">
              {c.kana.kana}
            </span>
            <span>{c.kana.romaji}</span>
            {c.first?.given && (
              <span className="text-ink2">
                you {mode === "read" ? "typed " : "picked "}
                <span lang={mode === "find" ? "ja" : undefined}>{c.first.given}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="m-0 text-[12.5px] text-ink2">They count towards your weakest kana, which you can practise from the start screen.</p>
    </section>
  );
}

/** Find it's options come from the scripts and groups in play, so a basic game never offers ファ. */
function optionPool(deck: GameKana[]): GameKana[] {
  const scripts = new Set(deck.map((k) => k.script));
  const groups = new Set(deck.map((k) => k.group));
  return ALL_KANA.filter((k) => scripts.has(k.script) && groups.has(k.group));
}
