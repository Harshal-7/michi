"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SessionLoading, useInBrowser } from "@/components/cards/loading";
import { VoiceProvider } from "@/components/cards/voice";
import type { SavedGame } from "@/lib/kana-game/data";
import { buildDeck, kanaFor } from "@/lib/kana-game/game";
import { type KanaAnswer, type PastGame, strengths, weakestFirst } from "@/lib/kana-game/progress";
import { summarise } from "@/lib/kana-game/score";
import { type GameKana, type GameSettings, type Mode, type Script, WEAKEST_COUNT } from "@/lib/kana-game/types";
import type { VoicePrefs } from "@/lib/voice/voices";

import { saveKanaGame } from "@/app/(app)/learn/kana/game/actions";

import { GameDone, type SaveStatus } from "./done";
import { Play, type PlayResult } from "./play";
import { StartScreen } from "./start";
import { loadSettings, pendingGames, setPendingGames, storeSettings } from "./store";

export type History = Record<Mode, { games: PastGame[]; answers: KanaAnswer[] }>;

type Phase =
  | { kind: "start" }
  | { kind: "play"; id: string; deck: GameKana[]; weakest: boolean; mode: Mode }
  | { kind: "done"; result: PlayResult; game: SavedGame | null; mode: Mode; weakest: boolean; previousBest: number | null };

export type KanaGameProps = { kana: GameKana[]; history: History; voice: VoicePrefs; script: Script | null };

/**
 * The kana game (inspired by GoKana): pick a way to play and the kana, clear the deck, then see
 * the score. Every kana picked is asked once; a miss shows the answer and comes back later.
 */
export function KanaGame(props: KanaGameProps) {
  return useInBrowser() ? <Game {...props} /> : <SessionLoading />;
}

function Game({ kana, history, voice, script }: KanaGameProps) {
  // A chart page links here with its script; everything else is as last time on this device.
  const [settings, setSettings] = useState<GameSettings>(() => ({ ...loadSettings(), ...(script ? { scripts: [script] } : {}) }));
  const [phase, setPhase] = useState<Phase>({ kind: "start" });
  const saver = useSaver();

  const update = (patch: Partial<GameSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    storeSettings(next);
  };

  const weakest = useMemo(() => {
    const byId = new Map(kana.map((k) => [k.id, k]));
    return Object.fromEntries(
      (["read", "find"] as const).map((mode) => [
        mode,
        weakestFirst(strengths(history[mode].answers))
          .map((s) => ({ ...s, kana: byId.get(s.itemId) }))
          .filter((s): s is typeof s & { kana: GameKana } => s.kana !== undefined),
      ]),
    ) as Record<Mode, (ReturnType<typeof strengths>[number] & { kana: GameKana })[]>;
  }, [kana, history]);

  const start = (useWeakest: boolean) => {
    const deck = useWeakest
      ? buildDeck(
          weakest[settings.mode].slice(0, WEAKEST_COUNT).map((s) => s.kana),
          0,
        )
      : buildDeck(kanaFor(kana, settings.scripts, settings.groups), settings.length);
    if (deck.length === 0) return;
    setPhase({ kind: "play", id: crypto.randomUUID(), deck, weakest: useWeakest, mode: settings.mode });
  };

  const finish = (result: PlayResult) => {
    if (phase.kind !== "play") return;
    const answers = result.cards.flatMap((c) =>
      c.first ? [{ itemId: c.kana.id, right: c.first.right, ms: Math.round(c.first.ms), given: c.first.given.slice(0, 40), tries: Math.max(1, c.tries) }] : [],
    );
    const previous = history[phase.mode].games;
    const previousBest = previous.length ? Math.max(...previous.map((g) => g.score)) : null;
    if (answers.length === 0) {
      setPhase({ kind: "start" });
      return;
    }
    const game: SavedGame = {
      id: phase.id,
      mode: phase.mode,
      weakest: phase.weakest,
      scripts: phase.weakest ? [...new Set(phase.deck.map((k) => k.script))] : settings.scripts,
      groups: phase.weakest ? [...new Set(phase.deck.map((k) => k.group))] : settings.groups,
      playedAt: new Date(result.startedAt).toISOString(),
      durationMs: Math.round(result.durationMs),
      bestStreak: result.bestStreak,
      answers,
    };
    setPhase({ kind: "done", result, game, mode: phase.mode, weakest: phase.weakest, previousBest });
    void saver.save(game);
  };

  if (phase.kind === "play") {
    return (
      <VoiceProvider prefs={voice}>
        <Play
          key={phase.id}
          deck={phase.deck}
          all={optionPool(kana, phase.deck)}
          mode={phase.mode}
          weakest={phase.weakest}
          tones={settings.tones}
          onEnd={finish}
        />
      </VoiceProvider>
    );
  }

  if (phase.kind === "done" && phase.game) {
    return (
      <GameDone
        result={phase.result}
        summary={summarise(phase.game.answers)}
        mode={phase.mode}
        weakest={phase.weakest}
        previousBest={phase.previousBest}
        save={saver.status}
        onRetrySave={() => void saver.flush()}
        onAgain={() => start(phase.weakest)}
        onSettings={() => setPhase({ kind: "start" })}
      />
    );
  }

  return (
    <StartScreen
      kana={kana}
      settings={settings}
      update={update}
      history={history}
      weakest={weakest[settings.mode]}
      waiting={saver.status.waiting}
      onStart={start}
    />
  );
}

/** Find it's options come from the scripts and groups in play, so a basic game never offers ファ. */
function optionPool(kana: GameKana[], deck: GameKana[]): GameKana[] {
  const scripts = new Set(deck.map((k) => k.script));
  const groups = new Set(deck.map((k) => k.group));
  return kana.filter((k) => scripts.has(k.script) && groups.has(k.group));
}

/**
 * Saves finished games, keeping any that don't make it on this device and trying them again
 * when the page opens, when the signal comes back, or on "Try again".
 */
function useSaver() {
  const [status, setStatus] = useState<SaveStatus>(() => ({ state: "idle", waiting: pendingGames().length }));
  const busy = useRef(false);

  const flush = useCallback(async () => {
    if (busy.current) return;
    const list = pendingGames();
    if (list.length === 0) return;
    busy.current = true;
    setStatus({ state: "saving", waiting: list.length });
    const left: SavedGame[] = [];
    for (const game of list) {
      try {
        const { ok } = await saveKanaGame(game);
        // A game the server turns away won't save on a retry either; drop it.
        if (!ok) console.error("The kana game wasn't accepted", game.id);
      } catch {
        left.push(game);
      }
    }
    setPendingGames(left);
    busy.current = false;
    setStatus({ state: left.length ? "waiting" : "saved", waiting: left.length });
  }, []);

  const save = useCallback(
    async (game: SavedGame) => {
      setPendingGames([...pendingGames().filter((g) => g.id !== game.id), game]);
      await flush();
    },
    [flush],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- games left from an earlier visit save on open
    void flush();
    const online = () => void flush();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [flush]);

  return { status, save, flush };
}
