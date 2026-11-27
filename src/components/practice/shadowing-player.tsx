"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { logPractice } from "@/app/(app)/practice/minutes-actions";
import { Ruby } from "@/components/ruby";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/lib/planner/day-plan";
import { sessionMinutes } from "@/lib/speaking/minutes";
import { canSpeak, loadVoices } from "@/lib/voice/speak";
import { estimateMs, speakAndWait, stopSpeaking } from "@/lib/voice/speak-wait";
import { spoken } from "@/lib/voice/spoken";
import { pickVoice, type VoicePrefs } from "@/lib/voice/voices";

const CROSS = "M6 6l12 12 M18 6L6 18";
const PLAY = "M8 5.5v13l10-6.5z";
const STOP = "M7 7h10v10H7z";
const SPEEDS = [0.8, 1] as const;
const PAUSES = [1, 1.5, 2] as const;
const ROW = "flex min-h-14 items-center justify-between gap-3";
const QUIET = "min-h-[50px] rounded-btn border border-line bg-surface text-[15px] font-semibold text-ink disabled:opacity-60";
const SOLID = "min-h-[50px] rounded-btn border-none bg-accent text-[15px] font-bold text-on-accent disabled:opacity-60";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The shadowing player (F_Shadowing): one sentence at a time, read by the phone's Japanese voice
 * at 0.8× or 1× the Settings speed, repeated with a pause to say it along. Minutes count from the
 * first Play and log themselves on Done, or when you leave the player.
 */
export function ShadowingPlayer({
  label,
  sentences,
  backHref,
  furigana,
  voice,
  minutesToday,
}: {
  /** "N5 daily life", for the top line. */
  label: string;
  sentences: { ja: string; en: string }[];
  backHref: string;
  furigana: boolean;
  voice: VoicePrefs;
  /** Speaking and shadowing minutes logged by themselves today. */
  minutesToday: number;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [repeat, setRepeat] = useState(0);
  const [repeats, setRepeats] = useState(3);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [pause, setPause] = useState<(typeof PAUSES)[number]>(1.5);
  const [voiceState, setVoiceState] = useState<"checking" | "ok" | "none" | "unsupported">("checking");
  const [problem, setProblem] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [logged, setLogged] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const run = useRef(0);
  /** The open session's start, for logging as the page goes away. */
  const open = useRef<number | null>(null);

  useEffect(() => {
    let live = true;
    void loadVoices(3000).then((all) => {
      if (live) setVoiceState(!canSpeak() ? "unsupported" : pickVoice(all, voice.name) ? "ok" : "none");
    });
    return () => {
      live = false;
    };
  }, [voice.name]);

  useEffect(() => {
    open.current = logged === null ? startedAt : null;
  }, [startedAt, logged]);

  useEffect(() => {
    if (startedAt === null || logged !== null) return;
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [startedAt, logged]);

  // Leaving without Done still logs the session, and stops the voice.
  useEffect(() => {
    const playRun = run;
    const send = () => {
      const at = open.current;
      if (at === null) return;
      open.current = null;
      const body = JSON.stringify({ kind: "shadowing", minutes: sessionMinutes(at, Date.now()) });
      navigator.sendBeacon?.("/api/practice-minutes", new Blob([body], { type: "application/json" }));
    };
    window.addEventListener("pagehide", send);
    return () => {
      window.removeEventListener("pagehide", send);
      playRun.current++;
      stopSpeaking();
      send();
    };
  }, []);

  const sentence = sentences[index];
  const last = index === sentences.length - 1;

  const stop = () => {
    run.current++;
    stopSpeaking();
    setPlaying(false);
    setRepeat(0);
  };

  const play = async () => {
    const id = ++run.current;
    setProblem(null);
    setPlaying(true);
    if (startedAt === null) {
      const at = Date.now();
      setStartedAt(at);
      setNow(at);
    }
    const text = spoken(sentence.ja);
    const rate = voice.rate * speed;
    for (let r = 1; r <= repeats; r++) {
      if (run.current !== id) return;
      setRepeat(r);
      const said = await speakAndWait(text, { name: voice.name, rate });
      if (run.current !== id) return;
      if (!said.ok) {
        setProblem("The voice couldn't read that. Check the Japanese voice in Settings.");
        break;
      }
      if (r < repeats) await sleep((said.ms > 300 ? said.ms : estimateMs(text, rate)) * pause);
    }
    if (run.current === id) {
      setPlaying(false);
      setRepeat(0);
    }
  };

  const go = (to: number) => {
    stop();
    setIndex(to);
  };

  const done = () =>
    startSaving(async () => {
      stop();
      if (startedAt === null) return;
      setError(null);
      try {
        const result = await logPractice({ kind: "shadowing", minutes: sessionMinutes(startedAt, Date.now()) });
        if ("error" in result) setError(result.error);
        else setLogged(result.minutes);
      } catch {
        setError("That didn't save. Check your signal and try again.");
      }
    });

  const again = () => {
    setLogged(null);
    setStartedAt(null);
    go(0);
  };

  const minutes = startedAt === null ? 0 : sessionMinutes(startedAt, Math.max(now, startedAt));
  const noVoice = voiceState === "none" || voiceState === "unsupported";

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <Link href={backHref} aria-label="Stop shadowing" className="-ml-2.5 inline-flex size-11 items-center justify-center rounded-btn text-ink2">
            <Icon d={CROSS} size={22} stroke={1.8} />
          </Link>
          <p className="m-0 text-[15px] font-bold">Shadowing</p>
          <p className="m-0 text-right text-[13px] text-ink2">
            {label} · {index + 1} of {sentences.length}
          </p>
        </div>
        <div role="img" aria-label={`Sentence ${index + 1} of ${sentences.length}`} className="mx-1.5 h-1 overflow-hidden rounded-full bg-track">
          <div className="h-full bg-accent" style={{ width: `${((index + 1) / sentences.length) * 100}%` }} />
        </div>
      </header>

      <section className="flex flex-col items-center gap-3 rounded-card bg-surface px-[18px] pt-7 pb-[22px] text-center shadow-card">
        <p className="m-0 font-card text-[30px] leading-[1.9]">
          <Ruby text={sentence.ja} furigana={furigana} />
        </p>
        <p className="m-0 text-[15px] text-ink2">{sentence.en}</p>
      </section>

      {noVoice ? (
        <p className="m-0 rounded-card border border-dashed border-line p-3 text-[13px] text-ink2">
          {voiceState === "unsupported" ? (
            "This browser can't speak. Chrome on Android and on the Mac can."
          ) : (
            <>
              No Japanese voice on this device yet. Android Settings → Text-to-speech → Speech Services by Google → Install voice data →
              Japanese.{" "}
              <Link href={ROUTES.voice} className="font-semibold text-accent">
                Japanese voice settings
              </Link>
            </>
          )}
        </p>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            aria-label={playing ? "Stop" : "Play the sentence"}
            disabled={voiceState === "checking" || logged !== null}
            onClick={() => (playing ? stop() : void play())}
            className="inline-flex size-[88px] items-center justify-center rounded-full border-none bg-accent text-on-accent shadow-nav disabled:opacity-60"
          >
            {playing ? (
              <Icon d={STOP} size={32} stroke={2} />
            ) : (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d={PLAY} />
              </svg>
            )}
          </button>
          <p className="m-0 text-[13px] text-ink2" aria-live="polite">
            Listen, then say it with the voice{playing && repeat > 0 ? ` · repeat ${repeat} of ${repeats}` : ""}
          </p>
          {problem && <p className="m-0 text-[13px]">{problem}</p>}
        </div>
      )}

      <section className="flex flex-col rounded-card bg-surface px-4 py-1.5 shadow-card">
        <div className={ROW}>
          <span className="text-sm font-semibold">Speed</span>
          <Segmented label="Speed" options={SPEEDS.map((s) => ({ value: s, label: `${s}×` }))} value={speed} onChange={setSpeed} />
        </div>
        <div className={`${ROW} border-t border-line`}>
          <span className="text-sm font-semibold">Repeats</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Fewer repeats"
              disabled={repeats <= 1}
              onClick={() => setRepeats((n) => Math.max(1, n - 1))}
              className="size-11 rounded-full border border-line bg-transparent text-lg text-ink disabled:opacity-40"
            >
              −
            </button>
            <span className="min-w-6 text-center text-base font-bold" aria-live="polite">
              {repeats}
            </span>
            <button
              type="button"
              aria-label="More repeats"
              disabled={repeats >= 5}
              onClick={() => setRepeats((n) => Math.min(5, n + 1))}
              className="size-11 rounded-full border border-line bg-transparent text-lg text-ink disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>
        <div className={`${ROW} border-t border-line`}>
          <span className="flex flex-col">
            <span className="text-sm font-semibold">Pause between</span>
            <span className="text-xs text-ink2">times the sentence</span>
          </span>
          <Segmented label="Pause between repeats" options={PAUSES.map((p) => ({ value: p, label: `${p}×` }))} value={pause} onChange={setPause} />
        </div>
      </section>

      <div className="mt-auto flex flex-col gap-2.5">
        <p className="m-0 text-center text-[13px] text-ink2" aria-live="polite">
          {logged !== null ? `Logged ${logged} min. ` : ""}
          {minutesToday} min today · logged by itself
        </p>
        {error && (
          <p role="alert" className="m-0 text-center text-[13px]">
            {error}
          </p>
        )}
        {logged !== null ? (
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={again} className={QUIET}>
              Again
            </button>
            <Link href={backHref} className={`${SOLID} flex items-center justify-center no-underline`}>
              {backHref === ROUTES.shadowing ? "Pick another set" : "Back to speaking"}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" disabled={index === 0} onClick={() => go(index - 1)} className={QUIET}>
              Previous
            </button>
            {last ? (
              startedAt === null ? (
                <Link href={backHref} className={`${SOLID} flex items-center justify-center no-underline`}>
                  Done
                </Link>
              ) : (
                <button type="button" disabled={saving} onClick={done} className={SOLID}>
                  Done · logs {minutes} min
                </button>
              )
            ) : (
              <button type="button" onClick={() => go(index + 1)} className={SOLID}>
                Next
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** A segmented control like Settings → Theme: the picked option raised on the surface. */
function Segmented<T extends number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-btn bg-surface2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 min-w-[52px] rounded-btn border-none px-2 text-sm ${
            o.value === value ? "bg-surface font-bold text-ink shadow-card" : "bg-transparent font-medium text-ink2"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
