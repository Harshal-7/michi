"use client";
// design-lint: legacy

import { useCallback, useEffect, useRef, useState } from "react";

import { useSpeak } from "@/components/ui/voice";
import { Icon } from "@/components/ui/icon";
import { hueStyle } from "@/lib/games/catalog";
import { findOptions, isRightTyping, judgeTyped } from "@/lib/games/kana/answer";
import { type GameKana, MODE_LABELS, type Mode } from "@/lib/games/kana/types";
import { DEFAULT_SPEED } from "@/lib/games/score";
import { answer, currentCard, type FirstAnswer, type GameState, isFinished, isRetry, startGame } from "@/lib/games/turns";
import { japaneseVoices } from "@/lib/voice/voices";
import { loadVoices } from "@/lib/voice/speak";

import { playTone, wakeTones } from "../tones";

const X_ICON = "M6 6l12 12 M18 6L6 18";
const SPEAKER = "M4 9.5h3.5L12 5.5v13l-4.5-4H4z M15.5 9a4 4 0 0 1 0 6 M18 6.5a7.5 7.5 0 0 1 0 11";

/** How long a missed answer stays on screen before the game moves on (Enter moves on sooner). */
const MISS_MS = 1800;
/** How long a right pick in Find it stays green. */
const PICKED_MS = 320;
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
 * A game in play, full screen in the play look (P_Play): a chunky progress bar and the streak,
 * the kana or the romaji on a plain card (the game's colour only in the small parts), the answer below, a bar for the speed
 * points, why a miss was wrong, and the last few answers.
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
  const input = useRef<HTMLInputElement>(null);
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
    if (mode === "read") input.current?.focus();
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

  return (
    <div style={hueStyle("kana")} className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-page">
      <header className="mx-auto flex w-full max-w-[680px] shrink-0 flex-col gap-2.5 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-2 laptop:px-0 laptop:pt-16">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Stop the game"
            onMouseDown={keepFocus}
            onClick={stop}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface2 text-ink"
          >
            <Icon d={X_ICON} size={18} stroke={2.4} />
          </button>
          <div role="img" aria-label={`${cleared} of ${deck.length} done`} className="h-3.5 flex-auto overflow-hidden rounded-full bg-track">
            <div className="h-full rounded-full bg-hue" style={{ width: `${(cleared / deck.length) * 100}%` }} />
          </div>
          <p className="m-0 min-w-11 text-right text-sm font-black tabular-nums">
            {cleared}/{deck.length}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="m-0 text-[13px] font-black tracking-[0.04em] text-hue uppercase">
            {weakest ? "Weakest kana" : "Kana game"} · {MODE_LABELS[mode]}
          </p>
          {counted.streak > 1 && <span className="rounded-full bg-hue-tint px-2.5 py-1 text-[12.5px] font-black text-hue">{counted.streak} in a row</span>}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[680px] flex-auto flex-col gap-3.5 px-4 pt-1 pb-5 laptop:px-0">
        <section
          className={`relative flex min-h-[250px] shrink-0 flex-col items-center justify-center gap-2 rounded-[32px] bg-surface p-[18px] text-center ${
            feedback?.kind === "miss" ? "shadow-[0_0_0_3px_var(--again)]" : flash || feedback?.kind === "right" ? "shadow-[0_0_0_3px_var(--good)]" : "shadow-card"
          }`}
        >
          <p className="absolute top-4 left-[18px] m-0 text-[12.5px] font-black text-hue">
            {kana.script === "katakana" ? "Katakana" : "Hiragana"}
            {retry ? " · again" : ""}
          </p>
          {mode === "read" ? (
            <p lang="ja" className={`m-0 font-card leading-[1.05] font-black ${[...kana.kana].length > 1 ? "text-[100px] laptop:text-[120px]" : "text-[140px] laptop:text-[150px]"}`}>
              {kana.kana}
            </p>
          ) : (
            <>
              <p className="m-0 text-[92px] leading-[1.05] font-black tracking-[0.02em] laptop:text-[96px]">{kana.romaji}</p>
              {hasVoice && (
                <button
                  type="button"
                  aria-label={`Say ${kana.romaji} again`}
                  onClick={() => say(kana.kana)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-btn bg-surface px-3.5 text-[13px] font-bold text-ink"
                >
                  <Icon d={SPEAKER} size={16} stroke={2} />
                  Again · Space
                </button>
              )}
            </>
          )}
        </section>

        <div className="flex items-center gap-2.5">
          <div role="img" aria-label="Time for speed points" className="h-1.5 flex-auto overflow-hidden rounded-full bg-track">
            <SpeedBar shownAt={shownAt} running={!feedback} />
          </div>
          <span className="text-xs font-bold whitespace-nowrap text-ink2">{live === null ? "speed bonus" : `Score ${live}`}</span>
        </div>

        {mode === "read" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (feedback) advance(feedback.next);
              else if (typed.trim()) submit(isRightTyping(typed, kana), typed.trim());
            }}
          >
            <label className="flex flex-col gap-1.5 text-[13px] font-black text-ink2">
              Type the romaji
              <input
                ref={input}
                type="text"
                value={typed}
                onChange={(e) => onType(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                aria-describedby="kana-feedback"
                aria-invalid={feedback?.kind === "miss" || undefined}
                className={`box-border min-h-[66px] rounded-[22px] border-2 bg-surface px-5 text-[30px] font-black tracking-[0.03em] text-ink outline-none ${
                  feedback?.kind === "miss" ? "border-again" : "border-[color-mix(in_srgb,var(--ink)_28%,transparent)]"
                }`}
              />
            </label>
          </form>
        ) : (
          options && (
            <div role="group" aria-label="Pick the kana" className="grid grid-cols-2 gap-2.5">
              {options.options.map((o, i) => {
                const right = i === options.answerIndex;
                const picked = feedback?.pick === i;
                const mark = feedback && right ? "right" : picked && !right ? "wrong" : null;
                const style = mark === "right" ? "border-[3px] border-good" : mark === "wrong" ? "border-[3px] border-again" : "border-2 border-line shadow-card";
                return (
                  <button
                    key={o.key}
                    type="button"
                    disabled={feedback !== null}
                    onClick={() => submit(right, o.kana, i)}
                    className={`relative flex min-h-24 items-center justify-center rounded-3xl bg-surface laptop:min-h-[100px] ${style}`}
                  >
                    <span className="absolute top-2.5 left-3.5 text-[12.5px] font-black text-ink2">{i + 1}</span>
                    <span lang="ja" className="font-card text-[42px] leading-[1.1] font-black laptop:text-[52px]">
                      {o.kana}
                    </span>
                    {mark && (
                      <span
                        aria-label={mark === "right" ? "the answer" : "your pick"}
                        className={`absolute top-2.5 right-3 inline-flex size-6 items-center justify-center rounded-full text-sm font-black text-page ${mark === "right" ? "bg-good" : "bg-again"}`}
                      >
                        {mark === "right" ? "✓" : "✕"}
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
            <div role="alert" className="flex items-center gap-3 rounded-[20px] bg-surface px-4 py-3.5 shadow-[0_0_0_2px_var(--again)]">
              <div className="flex flex-auto flex-col gap-1">
                <p className="m-0 text-base font-black text-again">
                  <span lang="ja" className="font-card">
                    {kana.kana}
                  </span>{" "}
                  is {kana.romaji}
                </p>
                <p className="m-0 text-[13.5px] leading-normal text-ink2">
                  {feedback.given ? `You ${mode === "read" ? "typed" : "picked"} ` : ""}
                  {feedback.given && <span lang={mode === "find" ? "ja" : undefined}>{feedback.given}</span>}
                  {feedback.given ? ". " : ""}It comes back in a few cards.
                </p>
              </div>
              <button
                type="button"
                onMouseDown={keepFocus}
                onClick={() => advance(feedback.next)}
                className="min-h-12 shrink-0 rounded-btn bg-ink px-5 text-[15px] font-black text-page"
              >
                Next<span className="hidden laptop:inline"> · Enter</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2.5">
          <div aria-label="Last few answers" className="flex items-center gap-1.5">
            {recent.map((r, i) => (
              <span
                key={`${r.kana}-${i}`}
                role="img"
                aria-label={`${r.kana} ${r.romaji}, ${r.right ? "right" : "missed"}`}
                className={`inline-flex size-[34px] items-center justify-center rounded-full bg-surface font-card text-[15px] font-black ${
                  r.right ? "text-good shadow-[inset_0_0_0_2px_var(--good)]" : "text-again shadow-[inset_0_0_0_2px_var(--again)]"
                }`}
              >
                <span lang="ja" aria-hidden="true">
                  {r.kana}
                </span>
              </span>
            ))}
          </div>
          {!feedback && (
            <button
              type="button"
              onMouseDown={keepFocus}
              onClick={() => submit(false, "")}
              className="min-h-11 shrink-0 rounded-btn border-2 border-line bg-surface px-4 text-sm font-bold"
            >
              Show me
            </button>
          )}
        </div>
        <p className="m-0 mt-auto text-center text-[12.5px] leading-normal text-ink2">
          {mode === "read" ? "It moves on as soon as the romaji is right. Quicker answers score more." : "Keys 1 to 4 pick, Space says it again. Quicker answers score more."}{" "}
          <span className="hidden laptop:inline">Esc stops.</span>
        </p>
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

/**
 * The speed bar: fills over the 5 seconds that earn speed points and turns amber once they're
 * gone. The browser animates it (`transform`), so it slides smoothly while typing re-renders.
 */
const NO_SPEED_MS = DEFAULT_SPEED.noneMs;

function SpeedBar({ shownAt, running }: { shownAt: number; running: boolean }) {
  const fill = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = fill.current;
    if (!el) return;
    const elapsed = Math.max(0, Date.now() - shownAt);
    const from = Math.min(1, elapsed / NO_SPEED_MS);
    el.dataset.over = elapsed > NO_SPEED_MS ? "true" : "false";
    if (!running || from >= 1) {
      el.style.transform = `scaleX(${from})`;
      return;
    }
    const slide = el.animate([{ transform: `scaleX(${from})` }, { transform: "scaleX(1)" }], {
      duration: NO_SPEED_MS - elapsed,
      easing: "linear",
      fill: "forwards",
    });
    slide.onfinish = () => (el.dataset.over = "true");
    return () => slide.cancel();
  }, [shownAt, running]);
  return (
    <div ref={fill} data-over="false" style={{ transform: "scaleX(0)" }} className="h-full w-full origin-left bg-good data-[over=true]:bg-warn" />
  );
}
