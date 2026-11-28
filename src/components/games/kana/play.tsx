"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Rabbit } from "@/components/ui/art/rabbit";
import { Button } from "@/components/ui/button";
import { AnswerInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { TimerBar } from "@/components/ui/progress";
import { useSpeak } from "@/components/ui/voice";
import { Kbd } from "@/components/play/bits";
import { hueStyle } from "@/lib/games/catalog";
import { findOptions, isRightTyping, judgeTyped } from "@/lib/games/kana/answer";
import { type GameKana, MODE_LABELS, type Mode } from "@/lib/games/kana/types";
import { DEFAULT_SPEED } from "@/lib/games/score";
import { answer, currentCard, type FirstAnswer, type GameState, isFinished, isRetry, startGame } from "@/lib/games/turns";
import { japaneseVoices } from "@/lib/voice/voices";
import { loadVoices } from "@/lib/voice/speak";

import { playTone, wakeTones } from "../tones";

/** How long a missed answer stays on screen before the game moves on (Enter moves on sooner). */
const MISS_MS = 1800;
/** How long a right pick in Find it stays green. */
const PICKED_MS = 320;
/** The speed bar fills over the 5 seconds that earn speed points, then turns amber (ui TimerBar). */
const NO_SPEED_MS = DEFAULT_SPEED.noneMs;
/** ん takes n or nn: after an n, this long without another letter counts as n. */
const MORE_LETTERS_MS = 450;

export type PlayResult = {
  cards: { kana: GameKana; first: FirstAnswer | null; tries: number }[];
  startedAt: number;
  durationMs: number;
  bestStreak: number;
  stopped: boolean;
};

type Recent = { kana: string; romaji: string; right: boolean };
type Feedback = { kind: "miss"; given: string; next: GameState; pick: number | null } | { kind: "right"; next: GameState; pick: number };
type Options = { options: GameKana[]; answerIndex: number };

/**
 * A game in play, full screen (RF_PlayKanaInPlay): a chunky progress bar with the rabbit riding it and
 * the streak, the kana or the romaji big on a plain card (the game's colour only in the small parts),
 * the answer below, a bar for the speed points, why a miss was wrong, and the last few answers.
 */
export function Play({
  deck,
  all,
  mode,
  weakest,
  tones,
  onEnd,
}: {
  deck: GameKana[];
  all: GameKana[];
  mode: Mode;
  weakest: boolean;
  tones: boolean;
  onEnd: (result: PlayResult) => void;
}) {
  const [state, setState] = useState<GameState>(() => startGame(deck.length));
  const [startedAt] = useState(() => Date.now());
  const [shownAt, setShownAt] = useState(() => Date.now());
  const [away, setAway] = useState(0);
  const [typed, setTyped] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [flash, setFlash] = useState(false);
  const [options, setOptions] = useState<Options | null>(() => (mode === "find" ? findOptions(deck[0], all) : null));
  const [hasVoice, setHasVoice] = useState(false);
  // ui AnswerInput doesn't type a ref yet, so the box is found inside its form.
  const answerForm = useRef<HTMLFormElement>(null);
  const moreLetters = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useSpeak();

  const index = currentCard(state);
  const kana = index === null ? null : deck[index];
  // The counts include an answer still on screen.
  const counted = feedback ? feedback.next : state;
  const cleared = deck.length - counted.queue.length;
  const firsts = counted.first.filter((f) => f !== null).length;
  const live = firsts ? Math.round(counted.points / firsts) : null;

  const end = useCallback(
    (final: GameState, stopped: boolean) => {
      if (tones && !stopped) playTone("done");
      onEnd({
        cards: deck.map((k, i) => ({ kana: k, first: final.first[i], tries: final.tries[i] })),
        startedAt,
        durationMs: Date.now() - startedAt - away,
        bestStreak: final.bestStreak,
        stopped,
      });
    },
    [deck, onEnd, startedAt, away, tones],
  );

  /** Shows the next card, or ends the game when the deck is clear. */
  const advance = useCallback(
    (next: GameState) => {
      setFeedback(null);
      setTyped("");
      if (isFinished(next)) {
        end(next, false);
        return;
      }
      setState(next);
      const t = Date.now();
      setShownAt(t);
      if (mode === "find") setOptions(findOptions(deck[currentCard(next)!], all));
    },
    [end, mode, deck, all],
  );

  const submit = useCallback(
    (right: boolean, given: string, pick: number | null = null) => {
      if (!kana || feedback) return;
      if (moreLetters.current) clearTimeout(moreLetters.current);
      const ms = Date.now() - shownAt;
      const next = answer(state, { right, ms, given });
      if (!isRetry(state)) setRecent((r) => [{ kana: kana.kana, romaji: kana.romaji, right }, ...r].slice(0, 5));
      if (tones) playTone(right ? "right" : "miss");
      if (right) {
        setFlash(true);
        if (mode === "find" && pick !== null) setFeedback({ kind: "right", next, pick });
        else advance(next);
      } else {
        setTyped("");
        setFeedback({ kind: "miss", given, next, pick });
      }
    },
    [kana, feedback, shownAt, state, tones, mode, advance],
  );

  // A miss (or a right pick) stays a moment, then the game moves on.
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => advance(feedback.next), feedback.kind === "miss" ? MISS_MS : PICKED_MS);
    return () => clearTimeout(timer);
  }, [feedback, advance]);

  // Read it: the input keeps focus from card to card, so the phone's keyboard stays up.
  useEffect(() => {
    if (mode === "read") answerForm.current?.querySelector("input")?.focus();
  }, [mode, index, feedback]);

  // Find it: say the kana when the device has a Japanese voice.
  useEffect(() => {
    let live = true;
    void loadVoices().then((v) => live && setHasVoice(japaneseVoices(v).length > 0));
    return () => {
      live = false;
    };
  }, []);
  const tries = index === null ? 0 : state.tries[index];
  useEffect(() => {
    if (mode === "find" && hasVoice && kana) say(kana.kana);
  }, [mode, hasVoice, kana, tries, say]);

  // Time away from the tab (another app, the phone locked) counts for nothing.
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt !== null) {
        const gone = Date.now() - hiddenAt;
        hiddenAt = null;
        setShownAt((t) => t + gone);
        setAway((a) => a + gone);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // A right answer rings the next card green for a moment.
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(false), 260);
    return () => clearTimeout(timer);
  }, [flash]);

  useEffect(() => () => void (moreLetters.current && clearTimeout(moreLetters.current)), []);

  const stop = useCallback(() => end(feedback ? feedback.next : state, true), [end, feedback, state]);

  // Keys: Esc stops; Find it: 1–4 pick, Space replays, Enter moves on after a miss.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        stop();
        return;
      }
      if (mode !== "find" || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter" && feedback) {
        e.preventDefault();
        advance(feedback.next);
      } else if (/^[1-4]$/.test(e.key) && options && !feedback) {
        const i = Number(e.key) - 1;
        if (options.options[i]) submit(i === options.answerIndex, options.options[i].kana, i);
      } else if ((e.key === " " || e.key.toLowerCase() === "r") && kana) {
        e.preventDefault();
        say(kana.kana);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, feedback, options, kana, stop, advance, submit, say]);

  if (!kana) return null;

  const onType = (value: string) => {
    if (feedback) return;
    setTyped(value);
    if (moreLetters.current) clearTimeout(moreLetters.current);
    const v = judgeTyped(value, kana);
    if (v.verdict === "right" && v.final) submit(true, value.trim());
    else if (v.verdict === "right") moreLetters.current = setTimeout(() => submit(true, value.trim()), MORE_LETTERS_MS);
    else if (v.verdict === "wrong") submit(false, value.trim());
  };

  const keepFocus = (e: React.MouseEvent) => {
    if (mode === "read") e.preventDefault();
  };
  const retry = isRetry(state);
  const pct = (cleared / deck.length) * 100;
  return (
    <div style={hueStyle("kana")} className="fixed inset-0 z-session flex flex-col overflow-y-auto bg-page">
      <header className="mx-auto w-full max-w-170 shrink-0 px-4 pt-[max(24px,env(safe-area-inset-top))] laptop:px-0 laptop:pt-14">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Stop the game"
            aria-keyshortcuts="Escape"
            onMouseDown={keepFocus}
            onClick={stop}
            className="grid size-12 shrink-0 place-items-center rounded-full bg-surface2 text-ink hover:bg-accent-soft"
          >
            <Icon name="close" />
          </button>
          <div className="relative h-12 flex-auto">
            <div aria-hidden="true" className="absolute -top-5 transition-[left] duration-300 ease-calm" style={{ left: `calc(${pct}% - 26px)` }}>
              <Rabbit pose="sitting" size={52} />
            </div>
            <div
              role="progressbar"
              aria-label={`${cleared} of ${deck.length} done`}
              aria-valuemin={0}
              aria-valuemax={deck.length}
              aria-valuenow={cleared}
              className="absolute inset-x-0 top-4.25 h-3.5 overflow-hidden rounded-full bg-track"
            >
              <div className="h-full rounded-full bg-hue transition-[width] duration-300 ease-calm" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <p className="m-0 min-w-13 text-right text-body font-black tabular-nums">
            {cleared}/{deck.length}
          </p>
        </div>
        <div className="mt-2 flex min-h-7 items-center justify-between gap-2">
          <p className="m-0 text-meta font-bold text-ink2">
            {weakest ? "Weakest kana" : "Kana game"} · {MODE_LABELS[mode]}
          </p>
          {counted.streak > 1 && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-track bg-hue-tint px-2.5 text-meta leading-none font-black text-hue">
              <Icon name="streak" size={16} />
              {counted.streak} in a row
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-170 flex-auto flex-col px-4 pt-3.5 pb-5.5 laptop:px-0">
        <section
          aria-label={mode === "read" ? "Kana to read" : "Sound to find"}
          className={`relative flex h-82.5 shrink-0 flex-col items-center justify-center gap-2 rounded-sheet border-[1.5px] border-line bg-surface p-4.5 text-center shadow-card transition-shadow duration-120 laptop:h-90 ${
            feedback?.kind === "miss" ? "ring-3 ring-again" : flash || feedback?.kind === "right" ? "ring-3 ring-good" : ""
          }`}
        >
          <p className="absolute top-4 left-5 m-0 text-meta font-bold text-hue">
            {kana.script === "katakana" ? "Katakana" : "Hiragana"}
            {retry ? " · again" : ""}
          </p>
          {mode === "read" ? (
            <p
              lang="ja"
              // design-lint-ignore-next-line text-size: the kana in play is drawn bigger than the scale's 72 (RF_PlayKanaInPlay: 176)
              className={`m-0 pb-3 font-ja leading-none text-ink ${[...kana.kana].length > 1 ? "text-[120px]" : "text-[176px]"}`}
            >
              {kana.kana}
            </p>
          ) : (
            <>
              {/* design-lint-ignore-next-line text-size: the romaji to find is drawn big, like the kana in Read it */}
              <p className="m-0 text-[92px] leading-none font-black tracking-[0.02em]">{kana.romaji}</p>
              {hasVoice && (
                <Button variant="secondary" size="sm" icon="speaker" onClick={() => say(kana.kana)} aria-label={`Say ${kana.romaji} again`}>
                  Again · Space
                </Button>
              )}
            </>
          )}
        </section>

        <div className="mt-3.5 flex items-center gap-2.5">
          <Icon name="clock" size={20} className="text-ink2" />
          <TimerBar startedAt={shownAt} durationMs={NO_SPEED_MS} running={!feedback} label="Time for speed points" className="flex-auto" />
          <span className="text-meta font-bold whitespace-nowrap text-ink2">{live === null ? "speed bonus" : `Score ${live}`}</span>
        </div>

        {mode === "read" ? (
          <form
            ref={answerForm}
            className="mt-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (feedback) advance(feedback.next);
              else if (typed.trim()) submit(isRightTyping(typed, kana), typed.trim());
            }}
          >
            <label htmlFor="romaji" className="mb-1.5 block text-meta font-bold text-ink2">
              Type the romaji
            </label>
            <AnswerInput
              id="romaji"
              type="text"
              value={typed}
              onChange={(e) => onType(e.target.value)}
              autoComplete="off"
              enterKeyHint="next"
              aria-describedby="kana-feedback kana-hint"
              state={feedback?.kind === "miss" ? "wrong" : "idle"}
            />
          </form>
        ) : (
          options && (
            <div role="group" aria-label="Pick the kana" className="mt-3.5 grid grid-cols-2 gap-2.5">
              {options.options.map((o, i) => {
                const right = i === options.answerIndex;
                const picked = feedback?.pick === i;
                const mark = feedback && right ? "right" : picked && !right ? "wrong" : null;
                const style = mark === "right" ? "border-2 border-good ring-3 ring-good/30" : mark === "wrong" ? "border-2 border-again ring-3 ring-again/30" : "border-[1.5px] border-line-strong shadow-card";
                return (
                  <button
                    key={o.key}
                    type="button"
                    aria-keyshortcuts={String(i + 1)}
                    disabled={feedback !== null}
                    onClick={() => submit(right, o.kana, i)}
                    className={`relative flex min-h-24 items-center justify-center rounded-card bg-surface text-ink hover:bg-surface2 laptop:min-h-25 ${style}`}
                  >
                    <span className="absolute top-2.5 left-3.5 text-meta font-bold text-ink2">{i + 1}</span>
                    <span lang="ja" className="font-ja text-display leading-tight">
                      {o.kana}
                    </span>
                    {mark && (
                      <span
                        role="img"
                        aria-label={mark === "right" ? "the answer" : "your pick"}
                        className={`absolute top-2.5 right-3 grid size-6 place-items-center rounded-full text-page ${mark === "right" ? "bg-good" : "bg-again"}`}
                      >
                        <Icon name={mark === "right" ? "check" : "close"} size={16} stroke={2.6} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )
        )}

        <div id="kana-feedback" aria-live="polite">
          {feedback?.kind === "miss" && (
            <div role="alert" className="mt-3.5 flex items-center gap-3 rounded-btn-lg border-2 border-again bg-again-soft px-4 py-3 text-on-cover">
              <div className="flex flex-auto flex-col gap-0.5">
                <p className="m-0 text-body font-black">
                  <span lang="ja" className="font-ja">
                    {kana.kana}
                  </span>{" "}
                  is {kana.romaji}
                </p>
                <p className="m-0 text-meta text-on-cover2">
                  {feedback.given ? `You ${mode === "read" ? "typed" : "picked"} ` : ""}
                  {feedback.given && <span lang={mode === "find" ? "ja" : undefined}>{feedback.given}</span>}
                  {feedback.given ? ". " : ""}It comes back in a few cards.
                </p>
              </div>
              <Button variant="secondary" onMouseDown={keepFocus} onClick={() => advance(feedback.next)} aria-keyshortcuts="Enter">
                Next
              </Button>
            </div>
          )}
        </div>

        <div className="mt-4.5 flex items-center justify-between gap-2.5">
          <div aria-label="Last few answers" className="flex items-center gap-1.5">
            {recent.map((r, i) => (
              <span
                key={`${r.kana}-${i}`}
                role="img"
                aria-label={`${r.kana} ${r.romaji}, ${r.right ? "right" : "missed"}`}
                className={`grid size-9 place-items-center rounded-full border-2 bg-surface ${r.right ? "border-good text-good" : "border-again text-again"}`}
              >
                <span lang="ja" aria-hidden="true" className="font-ja text-body leading-none">
                  {r.kana}
                </span>
              </span>
            ))}
          </div>
          {!feedback && (
            <Button variant="secondary" onMouseDown={keepFocus} onClick={() => submit(false, "")}>
              Show me
            </Button>
          )}
        </div>
        <div id="kana-hint" className="mt-auto flex flex-col items-center gap-2.5 pt-6 text-center text-meta text-ink2">
          <p className="m-0">
            {mode === "read" ? "It moves on as soon as the romaji is right. Quicker answers score more." : "Keys 1 to 4 pick, Space says it again. Quicker answers score more."}
          </p>
          <p className="m-0 flex items-center justify-center gap-2">
            <Kbd>Enter</Kbd>
            <span>next after a miss</span>
            <span aria-hidden="true">·</span>
            <Kbd>Esc</Kbd>
            <span>stop</span>
          </p>
        </div>
      </div>
      {/* The page's wake-up for tones on the very first card. */}
      <WakeTones on={tones} />
    </div>
  );
}

function WakeTones({ on }: { on: boolean }) {
  useEffect(() => {
    if (on) wakeTones();
  }, [on]);
  return null;
}

