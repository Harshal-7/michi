"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { logPractice } from "@/app/(app)/practice/minutes-actions";
import { VoiceProvider } from "@/components/cards/voice";
import { PlayIcon } from "@/components/learn/lesson-parts";
import { Ruby } from "@/components/ruby";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/lib/planner/day-plan";
import { compareSpoken } from "@/lib/speaking/compare";
import { sessionMinutes } from "@/lib/speaking/minutes";
import type { PromptOfTheDay } from "@/lib/speaking/practice";
import { canRecognise, listen, recognitionProblem } from "@/lib/speaking/recognition";
import { spoken } from "@/lib/voice/spoken";
import type { VoicePrefs } from "@/lib/voice/voices";

const MIC = "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z M5.5 11.5a6.5 6.5 0 0 0 13 0 M12 18v3";
const STOP = "M7 7h10v10H7z";
const PLAY = "M8 5.5v13l10-6.5z";
const CARD = "flex flex-col rounded-card bg-surface px-4 py-3.5 shadow-card";
const QUIET = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-btn border border-line bg-surface px-3.5 text-[13px] font-semibold text-ink disabled:opacity-60";

type Recorder = "idle" | "starting" | "recording" | "recorded" | "playing" | "played";

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * The speaking prompt (F_Speaking): the task, patterns to try, Record → Play back once (then the
 * recording is thrown away; nothing is uploaded), what speech recognition heard next to the
 * model answer, and Done, which logs the session's minutes.
 */
export function SpeakingPrompt({
  prompt,
  recognition,
  furigana,
  voice,
}: {
  prompt: PromptOfTheDay;
  /** Settings → Speech recognition. */
  recognition: boolean;
  furigana: boolean;
  voice: VoicePrefs;
}) {
  const [state, setState] = useState<Recorder>("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const [length, setLength] = useState(0);
  const [heard, setHeard] = useState("");
  const [heardProblem, setHeardProblem] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [recordAt, setRecordAt] = useState(0);
  const [now, setNow] = useState(0);
  const [logged, setLogged] = useState<string | null>(null);
  const [canHear, setCanHear] = useState<boolean | null>(null);
  const [saving, startSaving] = useTransition();

  const recorder = useRef<MediaRecorder | null>(null);
  const url = useRef<string | null>(null);
  const listening = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    // Known only in the browser; the server renders the quiet "checking" state.
    const id = setTimeout(() => setCanHear(canRecognise()), 0);
    return () => clearTimeout(id);
  }, []);

  // The minutes on Done tick while a session is open, and the recording clock while recording.
  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), state === "recording" ? 500 : 15_000);
    return () => clearInterval(id);
  }, [startedAt, state]);

  // Nothing outlives the page: stop the mic and drop any recording not played back.
  useEffect(
    () => () => {
      listening.current?.stop();
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );

  const discard = () => {
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
  };

  const record = async () => {
    setProblem(null);
    setHeardProblem(null);
    setLogged(null);
    discard();
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setProblem("This browser can't record. Chrome on Android and the Mac can.");
      return;
    }
    setState("starting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState("idle");
      setProblem("The microphone isn't available. Allow it for this site in the browser's settings, then try again.");
      return;
    }
    const at = Date.now();
    if (startedAt === null) setStartedAt(at);
    setNow(at);
    setRecordAt(at);
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    recorder.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      setLength(Date.now() - at);
      if (chunks.length === 0) {
        setState("idle");
        setProblem("Nothing was recorded. Try again.");
        return;
      }
      url.current = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType }));
      setState("recorded");
    };
    rec.start();
    setState("recording");

    if (recognition && canRecognise()) {
      setHeard("");
      listening.current = listen({
        onText: setHeard,
        onError: (error) => setHeardProblem(recognitionProblem(error)),
      });
    }
  };

  const stop = () => {
    listening.current?.stop();
    listening.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const playBack = () => {
    if (!url.current) return;
    const audio = new Audio(url.current);
    const done = () => {
      discard();
      setState("played");
    };
    audio.onended = done;
    audio.onerror = done;
    setState("playing");
    void audio.play().catch(done);
  };

  const finish = () =>
    startSaving(async () => {
      if (startedAt === null) return;
      stop();
      try {
        const result = await logPractice({ kind: "speaking", minutes: sessionMinutes(startedAt, Date.now()) });
        if ("error" in result) setLogged(result.error);
        else {
          setLogged(`Logged ${result.minutes} min of speaking.`);
          setStartedAt(null);
        }
      } catch {
        setLogged("That didn't save. Check your signal and try again.");
      }
    });

  const minutes = startedAt === null ? 0 : sessionMinutes(startedAt, Math.max(now, startedAt));
  const comparison = revealed && heard ? compareSpoken(prompt.model, heard) : null;
  const status =
    state === "recording"
      ? `Recording ${clock(now - recordAt)}`
      : state === "starting"
        ? "Starting the microphone…"
        : state === "recorded" || state === "playing"
          ? `${clock(length)} recorded`
          : state === "played"
            ? "Played back"
            : "Record your answer";
  const recognitionNote =
    canHear === null
      ? null
      : !recognition
        ? "Speech recognition is off in Settings, so there's no transcript. Recording still works."
        : !canHear
          ? "This browser has no speech recognition, so there's no transcript. Recording still works."
          : null;

  return (
    <VoiceProvider prefs={voice}>
      <section className={`${CARD} gap-1.5`}>
        <p className="m-0 text-[12.5px] text-ink2">Today&apos;s prompt</p>
        <p className="m-0 text-[17px] leading-snug font-semibold">{prompt.prompt}</p>
        {prompt.title && (
          <p lang="ja" className="m-0 font-card text-[17px] text-ink2">
            {prompt.title}
          </p>
        )}
      </section>

      {prompt.hints.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-ink2">Try using</span>
          {prompt.hints.map((h) => (
            <span key={h} className="rounded-btn border border-line px-3 py-[5px] text-sm">
              <Ruby text={h} furigana={furigana} />
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3.5">
        <button
          type="button"
          aria-label={state === "recording" ? "Stop recording" : "Record your answer"}
          disabled={state === "starting" || state === "playing"}
          onClick={() => (state === "recording" ? stop() : void record())}
          className="inline-flex size-[68px] shrink-0 items-center justify-center rounded-full border-none bg-accent text-on-accent shadow-nav disabled:opacity-60"
        >
          <Icon d={state === "recording" ? STOP : MIC} size={28} stroke={1.8} />
        </button>
        <div className="flex min-w-0 flex-auto flex-col gap-0.5" aria-live="polite">
          <p className="m-0 text-[15px] font-bold">{status}</p>
          <p className="m-0 text-xs text-ink2">Played back once, then thrown away</p>
        </div>
        <button type="button" disabled={state !== "recorded"} onClick={playBack} className={`${QUIET} shrink-0 whitespace-nowrap`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={PLAY} />
          </svg>
          Play back
        </button>
      </div>
      {problem && (
        <p role="alert" className="m-0 text-[13px]">
          {problem}
        </p>
      )}
      {recognitionNote && <p className="m-0 text-[12.5px] text-ink2">{recognitionNote}</p>}
      {heardProblem && <p className="m-0 text-[12.5px] text-ink2">{heardProblem}</p>}

      {revealed ? (
        <section className={`${CARD} gap-2`}>
          {heard && (
            <>
              <h2 className="m-0 text-xs font-bold text-ink2">What I heard</h2>
              <p lang="ja" className="m-0 font-card text-lg leading-[1.6]">
                {heard}
              </p>
              <div className="h-px bg-line" />
            </>
          )}
          <div className="flex items-center justify-between gap-2">
            <h2 className="m-0 text-xs font-bold text-ink2">Model answer</h2>
            <PlayIcon text={spoken(prompt.model)} label="Play the model answer" />
          </div>
          <p className="m-0 font-card text-lg leading-[1.85]">
            {comparison ? (
              comparison.segments.map((s, i) =>
                s.said ? (
                  <Ruby key={i} text={s.text} furigana={furigana} />
                ) : (
                  <mark key={i} className="rounded-[4px] bg-accent-soft px-0.5 text-ink">
                    <Ruby text={s.text} furigana={furigana} />
                  </mark>
                ),
              )
            ) : (
              <Ruby text={prompt.model} furigana={furigana} />
            )}
          </p>
          <p className="m-0 text-[13px] text-ink2">{prompt.modelEn}</p>
          {comparison && (
            <p className="m-0 text-[12.5px] text-ink2">
              {comparison.said === 1 ? "You said all of it." : "Highlighted: the part you didn't say."} Speech recognition never changes your reviews.
            </p>
          )}
        </section>
      ) : (
        <button type="button" onClick={() => setRevealed(true)} className={`${QUIET} min-h-12 text-[15px]`}>
          Show the model answer
        </button>
      )}

      <div className="mt-2 flex flex-col gap-2">
        <Link
          href={`${ROUTES.shadowing}?prompt=${prompt.id}`}
          className="flex min-h-12 items-center justify-center rounded-btn border border-line bg-surface text-[15px] font-semibold no-underline"
        >
          Shadow the model answer
        </Link>
        <button
          type="button"
          disabled={startedAt === null || saving}
          onClick={finish}
          className="min-h-[52px] rounded-btn border-none bg-accent text-[15px] font-bold text-on-accent disabled:opacity-60"
        >
          {startedAt === null ? "Done" : `Done · logs ${minutes} min`}
        </button>
        <p className="m-0 text-center text-[12.5px] text-ink2" aria-live="polite">
          {logged ?? (startedAt === null ? "Minutes count from your first Record." : " ")}
        </p>
      </div>
    </VoiceProvider>
  );
}
