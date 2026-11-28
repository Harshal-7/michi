"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { logPractice } from "@/app/(app)/practice/minutes-actions";
import { VoiceProvider } from "@/components/ui/voice";
import { SpeakButton } from "@/components/ui/speak-button";
import { Ruby } from "@/components/ui/ruby";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/lib/planner/day-plan";
import { compareSpoken } from "@/lib/speaking/compare";
import { sessionMinutes } from "@/lib/speaking/minutes";
import type { PromptOfTheDay } from "@/lib/speaking/practice";
import { canRecognise, listen, recognitionProblem } from "@/lib/speaking/recognition";
import { spoken } from "@/lib/voice/spoken";
import type { VoicePrefs } from "@/lib/voice/voices";


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

  const recording = state === "recording";

  return (
    <VoiceProvider prefs={voice}>
      <Card aria-label="Today's prompt" className="flex flex-col gap-1">
        <p className="m-0 text-meta text-ink2">Today&apos;s prompt</p>
        <p className="m-0 text-lead font-bold">{prompt.prompt}</p>
        {prompt.title && (
          <p lang="ja" className="m-0 font-ja text-lead font-semibold text-ink2">
            {prompt.title}
          </p>
        )}
      </Card>

      {prompt.hints.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-meta font-bold text-ink2">Try using</span>
          {prompt.hints.map((h) => (
            <span key={h} className="rounded-pill border-[1.5px] border-line bg-surface px-3 py-1 font-ja text-body leading-ja font-semibold">
              <Ruby text={h} furigana={furigana} />
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3.5">
        <button
          type="button"
          aria-label={recording ? "Stop recording" : "Record your answer"}
          disabled={state === "starting" || state === "playing"}
          onClick={() => (recording ? stop() : void record())}
          className={`grid size-17 shrink-0 place-items-center rounded-full border-2 transition-colors duration-120 disabled:border-line disabled:bg-surface2 disabled:text-ink3 ${
            recording ? "border-again bg-again-soft text-again" : "border-accent bg-accent-soft text-accent hover:bg-cover-blue"
          }`}
        >
          {recording ? <span aria-hidden="true" className="size-5.5 rounded-box bg-current" /> : <Icon name="mic" size={30} />}
        </button>
        <div className="flex min-w-0 flex-auto flex-col" aria-live="polite">
          <p className="m-0 text-body font-bold">{status}</p>
          <p className="m-0 text-meta text-ink2">Played back once, then thrown away</p>
        </div>
        <Button variant="secondary" size="sm" icon="play" disabled={state !== "recorded"} onClick={playBack}>
          Play back
        </Button>
      </div>
      {problem && (
        <p role="alert" className="m-0 text-meta font-bold text-again">
          {problem}
        </p>
      )}
      {recognitionNote && <p className="m-0 text-meta text-ink2">{recognitionNote}</p>}
      {heardProblem && <p className="m-0 text-meta text-ink2">{heardProblem}</p>}

      {revealed ? (
        <Card aria-label="Model answer" className="flex flex-col gap-2">
          {heard && (
            <>
              <h2 className="m-0 text-meta font-bold text-ink2">What I heard</h2>
              <p lang="ja" className="m-0 font-ja text-title leading-ja font-semibold">
                {heard}
              </p>
              <div className="h-[1.5px] bg-line" />
            </>
          )}
          <div className="flex items-center justify-between gap-2">
            <h2 className="m-0 text-meta font-bold text-ink2">Model answer</h2>
            <SpeakButton variant="icon" text={spoken(prompt.model)} label="Play the model answer" />
          </div>
          <p className="m-0 font-ja text-title leading-ja font-semibold">
            {comparison ? (
              comparison.segments.map((s, i) =>
                s.said ? (
                  <Ruby key={i} text={s.text} furigana={furigana} />
                ) : (
                  <mark key={i} className="rounded-box bg-accent-soft px-0.5 text-ink">
                    <Ruby text={s.text} furigana={furigana} />
                  </mark>
                ),
              )
            ) : (
              <Ruby text={prompt.model} furigana={furigana} />
            )}
          </p>
          <p className="m-0 text-body text-ink2">{prompt.modelEn}</p>
          {comparison && (
            <p className="m-0 text-meta text-ink2">
              {comparison.said === 1 ? "You said all of it." : "Highlighted: the part you didn't say."} Speech recognition never changes your reviews.
            </p>
          )}
        </Card>
      ) : (
        <Button variant="secondary" icon="eye" full onClick={() => setRevealed(true)}>
          Show the model answer
        </Button>
      )}

      <div className="mt-2 flex flex-col gap-2">
        <Button variant="secondary" icon="headphones" full href={`${ROUTES.shadowing}?prompt=${prompt.id}`}>
          Shadow the model answer
        </Button>
        <Button size="lg" full disabled={startedAt === null || saving} loading={saving} onClick={finish}>
          {startedAt === null ? "Done" : `Done · logs ${minutes} min`}
        </Button>
        <p className="m-0 text-center text-meta text-ink2" aria-live="polite">
          {logged ?? (startedAt === null ? "Minutes count from your first Record." : " ")}
        </p>
      </div>
    </VoiceProvider>
  );
}
