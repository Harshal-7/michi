"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useSpeak } from "@/components/cards/voice";
import { Icon } from "@/components/ui/icon";
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
 * A game in play, laid out like the quick check's kana sprint (F_QuickCheckKana): the kana or
 * the romaji on a card, the answer below, a bar for the speed points and the last few answers.
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
    <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-page laptop:static laptop:z-auto laptop:overflow-visible laptop:bg-transparent">
      <header className="flex shrink-0 flex-col gap-2.5 px-3 pt-[max(12px,env(safe-area-inset-top))] pb-2 laptop:px-0 laptop:pt-0">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Stop the game"
            onMouseDown={keepFocus}
            onClick={stop}
            className="inline-flex size-11 items-center justify-center rounded-btn text-ink2"
          >
            <Icon d={X_ICON} size={22} stroke={1.8} />
          </button>
          <p className="m-0 text-[15px] font-bold">
            {weakest ? "Weakest kana" : "Kana game"} · {MODE_LABELS[mode]}
          </p>
          <p className="m-0 min-w-11 text-right text-[13px] text-ink2">
            {cleared} / {deck.length}
          </p>
        </div>
        <div role="img" aria-label={`${cleared} of ${deck.length} done`} className="mx-1.5 h-1 overflow-hidden rounded-full bg-track">
          <div className="h-full bg-accent" style={{ width: `${(cleared / deck.length) * 100}%` }} />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[640px] flex-auto flex-col gap-4 px-5 pt-2 pb-5 laptop:px-0">
        <section
          className={`flex h-[210px] shrink-0 flex-col items-center justify-center gap-1 rounded-card bg-surface shadow-card ${
            feedback?.kind === "miss" ? "outline-2 outline-again" : flash ? "outline-2 outline-good" : ""
          }`}
        >
          <p className="m-0 text-xs font-semibold text-ink2">
            {kana.script === "katakana" ? "Katakana" : "Hiragana"}
            {retry ? " · again" : ""}
          </p>
          {mode === "read" ? (
            <p lang="ja" className={`m-0 font-card leading-[1.1] font-semibold ${[...kana.kana].length > 1 ? "text-[96px]" : "text-[124px]"}`}>
              {kana.kana}
            </p>
          ) : (
            <>
              <p className="m-0 font-head text-[64px] leading-[1.1] font-bold tracking-[0.02em]">{kana.romaji}</p>
              {hasVoice && (
                <button
                  type="button"
                  aria-label={`Say ${kana.romaji} again`}
                  onClick={() => say(kana.kana)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-btn border border-line bg-surface2 px-3.5 text-[13px] font-semibold text-ink"
                >
                  <Icon d={SPEAKER} size={18} stroke={1.7} />
                  Hear it
                </button>
              )}
            </>
          )}
        </section>

        {mode === "read" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (feedback) advance(feedback.next);
              else if (typed.trim()) submit(isRightTyping(typed, kana), typed.trim());
            }}
          >
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink2">
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
                className={`box-border min-h-[54px] rounded-btn border-2 bg-surface px-4 text-[22px] font-bold tracking-[0.04em] text-ink outline-none ${
                  feedback?.kind === "miss" ? "border-again" : "border-accent"
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
                const style =
                  feedback && right ? "border-2 border-good" : picked ? "border-2 border-again" : "border border-line";
                return (
                  <button
                    key={o.key}
                    type="button"
                    disabled={feedback !== null}
                    onClick={() => submit(right, o.kana, i)}
                    className={`relative flex min-h-[92px] items-center justify-center rounded-card bg-surface shadow-card ${style}`}
                  >
                    <span className="absolute top-2 left-3 text-[12.5px] font-bold text-ink2">{i + 1}</span>
                    <span lang="ja" className="font-card text-[44px] leading-[1.1] font-semibold">
                      {o.kana}
                    </span>
                  </button>
                );
              })}
            </div>
          )
        )}

        <p id="kana-feedback" aria-live="polite" className="m-0 min-h-[22px] text-center text-[15px]">
          {feedback?.kind === "miss" && (
            <span className="font-bold text-again">
              <span lang="ja" className="font-card">
                {kana.kana}
              </span>{" "}
              is {kana.romaji}
              {feedback.given && mode === "read" ? ` · you typed ${feedback.given}` : ""}
              <span className="font-normal text-ink2"> · back in a few cards</span>
            </span>
          )}
        </p>

        <div className="flex items-center gap-2.5">
          <div role="img" aria-label="Time for speed points" className="h-1.5 flex-auto overflow-hidden rounded-full bg-track">
            <SpeedBar shownAt={shownAt} running={!feedback} />
          </div>
          <span className="text-[12.5px] whitespace-nowrap text-ink2">
            {counted.streak > 1 ? `${counted.streak} in a row · ` : ""}
            {live === null ? "Score –" : `Score ${live}`}
          </span>
        </div>

        {recent.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="m-0 text-xs font-semibold text-ink2">Last few</p>
            <div className="flex flex-wrap gap-1.5">
              {recent.map((r, i) => (
                <span
                  key={`${r.kana}-${i}`}
                  className={`inline-flex items-baseline gap-1.5 rounded-full border px-2.5 py-[5px] text-[13px] ${r.right ? "border-good text-good" : "border-again text-again"}`}
                >
                  <span lang="ja" className="font-card text-base font-semibold">
                    {r.kana}
                  </span>
                  <span>{r.romaji}</span>
                  <span className="font-bold">{r.right ? "right" : "missed"}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={feedback !== null}
            onMouseDown={keepFocus}
            onClick={() => submit(false, "")}
            className="min-h-[50px] rounded-btn border border-line bg-surface text-[15px] font-bold disabled:opacity-45"
          >
            Show me
          </button>
          <button
            type="button"
            onMouseDown={keepFocus}
            onClick={stop}
            className="min-h-[50px] rounded-btn text-[15px] font-semibold text-ink2"
          >
            Stop here
          </button>
        </div>
        <p className="m-0 mt-auto text-center text-[12.5px] leading-normal text-ink2">
          {mode === "read"
            ? "It moves on as soon as the romaji is right. Quicker answers score more."
            : "Keys 1 to 4 pick, Space says it again. Quicker answers score more."}{" "}
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
