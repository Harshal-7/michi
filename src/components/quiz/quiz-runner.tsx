"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { answerAction, flagQuestionAction, startQuizAction, submitAction } from "@/app/(app)/practice/quiz-actions";
import { VoiceProvider } from "@/components/cards/voice";
import { Icon } from "@/components/ui/icon";
import type { Asked, QuizKind } from "@/lib/quiz/types";
import type { VoicePrefs } from "@/lib/voice/voices";

import { QuestionView } from "./question-view";
import { useHasJapaneseVoice } from "./use-voice";

const X_ICON = "M6 6l12 12 M18 6L6 18";
const FLAG_ICON = "M5 21V4 M5 4h11l-2 4 2 4H5";

export type RunnerQuestion = { id: number; asked: Asked; chosen: number | null };

/** The progress dots: green right, red wrong, accent now, track still to come. */
export function Dots({ marks, label, height = 6 }: { marks: ("good" | "again" | "now" | "")[]; label: string; height?: number }) {
  return (
    <div role="img" aria-label={label} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${marks.length}, minmax(0, 1fr))` }}>
      {marks.map((m, i) => (
        <span key={i} className={`rounded-full ${m === "good" ? "bg-good" : m === "again" ? "bg-again" : m === "now" ? "bg-accent" : "bg-track"}`} style={{ height }} />
      ))}
    </div>
  );
}

/** "Flag this question": a short note saved with the question as asked. */
export function FlagQuestion({ questionId }: { questionId: number }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return <p className="m-0 text-center text-[13px] text-ink2" role="status">{done}</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-1.5 self-center border-none bg-transparent text-[13px] text-ink2">
        <Icon d={FLAG_ICON} size={16} stroke={1.8} />
        Flag this question
      </button>
    );
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await flagQuestionAction({ questionId, note });
          setDone("ok" in r ? "Flagged. You'll find it in Settings → Flagged items." : r.error);
        });
      }}
    >
      <label className="flex flex-col gap-1.5 text-[12.5px] font-bold">
        What reads wrong?
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          placeholder="optional, like “から is right too”"
          className="min-h-11 rounded-xl border border-line bg-page px-3 text-[15px] font-normal focus-visible:border-accent"
        />
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 flex-1 rounded-btn border border-line bg-surface text-sm font-semibold">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="min-h-11 flex-1 rounded-btn border border-line bg-surface2 text-sm font-semibold disabled:opacity-60">
          Flag it
        </button>
      </div>
    </form>
  );
}

/**
 * A quiz in progress (F_QuizQuestion): one question at a time, answered with a tap or keys 1–4,
 * then "Next question". Answers are shown at once and saved in the background; a wrong one goes
 * back into reviews as it's saved. The last one leads to the results.
 */
export function QuizRunner({
  assessmentId,
  title,
  questions,
  furigana,
  voice,
}: {
  assessmentId: number;
  title: string;
  questions: RunnerQuestion[];
  furigana: boolean;
  voice: VoicePrefs;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<(number | null)[]>(() => questions.map((q) => q.chosen));
  const firstOpen = chosen.findIndex((c) => c === null);
  const [index, setIndex] = useState(firstOpen === -1 ? questions.length - 1 : firstOpen);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const q = questions[index];
  const pick = chosen[index];
  const last = index === questions.length - 1;
  const allAnswered = chosen.every((c) => c !== null);

  const choose = useCallback(
    (i: number) => {
      if (chosen[index] !== null) return;
      setChosen((c) => c.map((v, j) => (j === index ? i : v)));
      setError(null);
      void answerAction({ questionId: q.id, choice: i }).then((r) => {
        if ("error" in r) setError(r.error);
      });
    },
    [chosen, index, q.id],
  );

  const next = useCallback(() => {
    if (pick === null) return;
    if (!last) {
      setIndex((i) => i + 1);
      window.scrollTo({ top: 0 });
      return;
    }
    start(async () => {
      const r = await submitAction(assessmentId);
      if ("error" in r) setError(r.error);
      else router.refresh();
    });
  }, [assessmentId, last, pick, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[1-4]$/.test(e.key)) choose(Number(e.key) - 1);
      else if (e.key === "Enter" && pick !== null) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, next, pick]);

  const rightSoFar = chosen.filter((c, i) => c !== null && c === questions[i].asked.answer).length;
  const wrongSoFar = chosen.filter((c, i) => c !== null && c !== questions[i].asked.answer).length;
  const marks = questions.map((qq, i) => {
    const c = chosen[i];
    if (c !== null && i !== index) return c === qq.asked.answer ? "good" : "again";
    if (i === index) return c === null ? "now" : c === qq.asked.answer ? "good" : "again";
    return "";
  }) as ("good" | "again" | "now" | "")[];

  return (
    <VoiceProvider prefs={voice}>
      <div className="flex flex-col gap-3.5">
        <header className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <Link href="/practice" aria-label="Leave the quiz" className="inline-flex size-11 items-center justify-center rounded-btn text-ink2">
              <Icon d={X_ICON} size={22} stroke={1.8} />
            </Link>
            <p className="m-0 text-[15px] font-bold">{title}</p>
            <p className="m-0 min-w-11 text-right text-[13px] text-ink2">
              {index + 1} / {questions.length}
            </p>
          </div>
          <div className="mx-1.5">
            <Dots marks={marks} label={`Question ${index + 1} of ${questions.length}; ${rightSoFar} right and ${wrongSoFar} wrong so far`} />
          </div>
        </header>

        <QuestionView key={q.id} asked={q.asked} chosen={pick} onChoose={choose} furigana={furigana} />

        {error && (
          <p role="alert" className="m-0 text-[13px] font-semibold text-again">
            {error}
          </p>
        )}
        <div className="mt-2 flex flex-col items-stretch gap-1.5">
          <button
            type="button"
            disabled={pick === null || pending || (last && !allAnswered)}
            onClick={next}
            className="min-h-[54px] w-full rounded-btn border-none bg-accent text-base font-bold text-on-accent disabled:opacity-50"
          >
            {last ? "See results" : "Next question"}
          </button>
          <FlagQuestion key={q.id} questionId={q.id} />
        </div>
      </div>
    </VoiceProvider>
  );
}

/** The start of a quiz: what it holds and one Start button. It checks for a Japanese voice first. */
export function QuizStart({ kind, count, minutes, note }: { kind: QuizKind; count: number; minutes: number; note?: string }) {
  const router = useRouter();
  const hasVoice = useHasJapaneseVoice();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-hero">
      <p className="m-0 text-[15px] font-semibold">
        {count} questions · about {minutes} min
      </p>
      <p className="m-0 text-[13px] text-ink2">
        {note ?? "Kana, kanji readings, meanings, grammar, sentence order and one to listen to."} Wrong answers go back into your reviews.
      </p>
      {hasVoice === false && <p className="m-0 text-[13px] text-ink2">No Japanese voice on this device, so the listening question becomes a meaning question.</p>}
      <button
        type="button"
        disabled={pending || hasVoice === null}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await startQuizAction({ kind, hasVoice: hasVoice === true });
            if ("error" in r) setError(r.error);
            else router.refresh();
          })
        }
        className="min-h-[50px] rounded-btn border-none bg-accent text-[15px] font-bold text-on-accent disabled:opacity-60"
      >
        {pending ? "Starting…" : "Start"}
      </button>
      {error && (
        <p role="alert" className="m-0 text-[13px] font-semibold text-again">
          {error}
        </p>
      )}
    </section>
  );
}
