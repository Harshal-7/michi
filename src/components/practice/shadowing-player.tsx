"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { logPractice } from "@/app/(app)/practice/minutes-actions";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Ruby } from "@/components/ui/ruby";
import { Segmented } from "@/components/ui/segmented";
import { SessionHeader } from "@/components/ui/session-header";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/lib/planner/day-plan";
import { sessionMinutes } from "@/lib/speaking/minutes";
import { canSpeak, loadVoices } from "@/lib/voice/speak";
import { estimateMs, speakAndWait, stopSpeaking } from "@/lib/voice/speak-wait";
import { spoken } from "@/lib/voice/spoken";
import { pickVoice, type VoicePrefs } from "@/lib/voice/voices";

const SPEEDS = [0.8, 1] as const;
const PAUSES = [1, 1.5, 2] as const;
const ROW = "flex min-h-15 items-center justify-between gap-3";
const STEP = "grid size-11 place-items-center rounded-full border-[1.5px] border-line-strong bg-surface text-lead font-bold text-ink transition-colors duration-120 hover:bg-surface2 disabled:border-line disabled:text-ink3";

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
    <div className="mx-auto flex w-full max-w-160 flex-col gap-4">
      <SessionHeader
        title="Shadowing"
        count={`${index + 1} of ${sentences.length}`}
        close={{ label: "Stop shadowing", href: backHref }}
        progress={{ value: index + 1, max: sentences.length, label: `Sentence ${index + 1} of ${sentences.length}` }}
      />
      <p className="m-0 -mt-1 text-center text-meta text-ink2">{label}</p>

      <Card aria-label="The sentence" className="flex flex-col items-center gap-3 px-5 pt-7 pb-6 text-center">
        <p className="m-0 font-ja text-headline leading-ja font-semibold">
          <Ruby text={sentence.ja} furigana={furigana} />
        </p>
        <p className="m-0 text-body text-ink2">{sentence.en}</p>
      </Card>

      {noVoice ? (
        <Banner
          kind="info"
          title={voiceState === "unsupported" ? "This browser can't speak" : "No Japanese voice on this device yet"}
          action={
            voiceState === "unsupported" ? undefined : (
              <Button variant="quiet" size="sm" href={ROUTES.voice}>
                Voice settings
              </Button>
            )
          }
        >
          {voiceState === "unsupported"
            ? "Chrome on Android and on the Mac can."
            : "Android Settings → Text-to-speech → Speech Services by Google → Install voice data → Japanese."}
        </Banner>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            aria-label={playing ? "Stop" : "Play the sentence"}
            disabled={voiceState === "checking" || logged !== null}
            onClick={() => (playing ? stop() : void play())}
            className="grid size-22 place-items-center rounded-full border-2 border-accent bg-accent-soft text-accent transition-colors duration-120 hover:bg-cover-blue disabled:border-line disabled:bg-surface2 disabled:text-ink3"
          >
            {playing ? <Icon name="pause" size={36} /> : <Icon name="play" size={38} />}
          </button>
          <p className="m-0 text-meta text-ink2" aria-live="polite">
            Listen, then say it with the voice{playing && repeat > 0 ? ` · repeat ${repeat} of ${repeats}` : ""}
          </p>
          {problem && <p className="m-0 text-meta font-bold text-again">{problem}</p>}
        </div>
      )}

      <Card padding="none" aria-label="Playback" className="flex flex-col px-5 py-1">
        <div className={ROW}>
          <span className="text-body font-bold">Speed</span>
          <Segmented
            label="Speed"
            name="speed"
            className="w-40"
            options={SPEEDS.map((v) => ({ value: String(v), label: `${v}×` }))}
            value={String(speed)}
            onChange={(v) => setSpeed(Number(v) as (typeof SPEEDS)[number])}
          />
        </div>
        <div className={`${ROW} border-t-[1.5px] border-line`}>
          <span className="text-body font-bold">Repeats</span>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Fewer repeats" disabled={repeats <= 1} onClick={() => setRepeats((n) => Math.max(1, n - 1))} className={STEP}>
              −
            </button>
            <span className="min-w-6 text-center text-lead font-black" aria-live="polite">
              {repeats}
            </span>
            <button type="button" aria-label="More repeats" disabled={repeats >= 5} onClick={() => setRepeats((n) => Math.min(5, n + 1))} className={STEP}>
              +
            </button>
          </div>
        </div>
        <div className={`${ROW} border-t-[1.5px] border-line`}>
          <span className="flex flex-col">
            <span className="text-body font-bold">Pause between</span>
            <span className="text-meta text-ink2">times the sentence</span>
          </span>
          <Segmented
            label="Pause between repeats"
            name="pause"
            className="w-48"
            options={PAUSES.map((v) => ({ value: String(v), label: `${v}×` }))}
            value={String(pause)}
            onChange={(v) => setPause(Number(v) as (typeof PAUSES)[number])}
          />
        </div>
      </Card>

      <div className="mt-auto flex flex-col gap-2.5">
        <p className="m-0 text-center text-meta text-ink2" aria-live="polite">
          {logged !== null ? `Logged ${logged} min. ` : ""}
          {minutesToday} min today · logged by itself
        </p>
        {error && (
          <p role="alert" className="m-0 text-center text-meta font-bold text-again">
            {error}
          </p>
        )}
        {logged !== null ? (
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="secondary" size="lg" full onClick={again}>
              Again
            </Button>
            <Button size="lg" full href={backHref}>
              {backHref === ROUTES.shadowing ? "Pick another set" : "Back to speaking"}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="secondary" size="lg" full icon="chevron-left" disabled={index === 0} onClick={() => go(index - 1)}>
              Previous
            </Button>
            {last ? (
              startedAt === null ? (
                <Button size="lg" full href={backHref}>
                  Done
                </Button>
              ) : (
                <Button size="lg" full disabled={saving} loading={saving} onClick={done}>
                  Done · logs {minutes} min
                </Button>
              )
            ) : (
              <Button size="lg" full iconEnd="chevron-right" onClick={() => go(index + 1)}>
                Next
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
