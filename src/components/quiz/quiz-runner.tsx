"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState, useTransition } from "react";

import { answerAction, flagQuestionAction, startQuizAction, submitAction } from "@/app/(app)/practice/quiz-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { SessionHeader } from "@/components/ui/session-header";
import { VoiceProvider } from "@/components/ui/voice";
import type { Asked, QuizKind } from "@/lib/quiz/types";
import type { VoicePrefs } from "@/lib/voice/voices";

import { QuestionView } from "./question-view";
import { useHasJapaneseVoice } from "./use-voice";

export type RunnerQuestion = { id: number; asked: Asked; chosen: number | null };

/** The progress dots (RF_QuizQuestion): good right, again wrong, accent now, track still to come. */
export function Dots({ marks, label }: { marks: ("good" | "again" | "now" | "")[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="flex gap-1">
      {marks.map((m, i) => (
        <span key={i} className={`h-2.5 flex-1 rounded-full ${m === "good" ? "bg-good" : m === "again" ? "bg-again" : m === "now" ? "bg-accent" : "bg-track"}`} />
      ))}
    </div>
  );
}

/** "Flag this question": a short note saved with the question as asked, opened from the header's flag. */
export function FlagQuestion({ questionId, open, onClose }: { questionId: number; open: boolean; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done)
    return (
      <p className="m-0 text-center text-meta text-ink2" role="status">
        {done}
      </p>
    );
  if (!open) return null;
  return (
    <Card
      as="div"
      className="flex flex-col gap-3"
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await flagQuestionAction({ questionId, note });
            setDone("ok" in r ? "Flagged. You’ll find it in Settings → Flagged items." : r.error);
          });
        }}
      >
        <Field
          label="What reads wrong?"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          placeholder="optional, like “から is right too”"
        />
        <div className="flex justify-end gap-2">
          <Button variant="text" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" type="submit" icon="flag" loading={pending} disabled={pending}>
            Flag it
          </Button>
        </div>
      </form>
    </Card>
  );
}

/**
 * The frame of a quiz-like session (RF_QuizQuestion): the session header with close, title, count and
 * the flag, the dots under it, the question scrolling in the middle and the one button pinned at the
 * bottom. Full screen on the phone, the centred column on a laptop.
 */
export function QuizShell({
  title,
  count,
  close,
  marks,
  marksLabel,
  flag,
  footer,
  children,
}: {
  title: string;
  count: string;
  close: { href: string; label: string };
  marks: ("good" | "again" | "now" | "")[];
  marksLabel: string;
  /** The flag button's state, when the question can be flagged. */
  flag?: { open: boolean; toggle: () => void };
  footer: ReactNode;
  children: ReactNode;
}) {
  // Each new question starts at the top of the scrolling middle.
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [count]);
  return (
    <div className="fixed inset-0 z-session flex flex-col bg-page laptop:static laptop:z-auto laptop:mx-auto laptop:w-full laptop:max-w-160 laptop:gap-2 laptop:bg-transparent">
      <div className="flex shrink-0 flex-col gap-2 px-2.5 pt-[max(12px,env(safe-area-inset-top))] laptop:p-0">
        <SessionHeader
          title={title}
          count={count}
          close={close}
          trailing={flag && <IconButton icon="flag" label="Flag this question" pressed={flag.open} onClick={flag.toggle} />}
        />
        <div className="mx-3.5 laptop:mx-2">
          <Dots marks={marks} label={marksLabel} />
        </div>
      </div>
      <div ref={body} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pt-5.5 pb-4 laptop:overflow-visible laptop:px-0">{children}</div>
      <div className="shrink-0 px-5 pb-[max(20px,env(safe-area-inset-bottom))] laptop:px-0">{footer}</div>
    </div>
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
  const [flagging, setFlagging] = useState(false);
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
      setFlagging(false);
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
      <QuizShell
        title={title}
        count={`${index + 1} / ${questions.length}`}
        close={{ href: "/practice", label: "Leave the quiz" }}
        marks={marks}
        marksLabel={`Question ${index + 1} of ${questions.length}; ${rightSoFar} right and ${wrongSoFar} wrong so far`}
        flag={{ open: flagging, toggle: () => setFlagging((f) => !f) }}
        footer={
          <Button size="lg" full disabled={pick === null || pending || (last && !allAnswered)} loading={pending} onClick={next}>
            {last ? "See results" : "Next question"}
          </Button>
        }
      >
        <QuestionView
          key={`question-${q.id}`}
          asked={q.asked}
          chosen={pick}
          onChoose={choose}
          furigana={furigana}
          aside={
            rightSoFar + wrongSoFar > 0 ? `${rightSoFar} right · ${wrongSoFar} to review` : undefined
          }
        />
        {error && (
          <p role="alert" className="m-0 text-meta font-bold text-again">
            {error}
          </p>
        )}
        <FlagQuestion key={`flag-${q.id}`} questionId={q.id} open={flagging} onClose={() => setFlagging(false)} />
      </QuizShell>
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
    <Card className="flex flex-col gap-3">
      <p className="m-0 text-lead font-black">
        {count} questions · about {minutes} min
      </p>
      <p className="m-0 text-body text-ink2">
        {note ?? "Kana, kanji readings, meanings, grammar, sentence order and one to listen to."} Wrong answers go back into your reviews.
      </p>
      {hasVoice === false && (
        <p className="m-0 flex items-start gap-2 text-meta text-ink2">
          <Icon name="info" size={18} className="mt-px text-ink3" />
          No Japanese voice on this device, so the listening question becomes a meaning question.
        </p>
      )}
      <Button
        size="lg"
        full
        icon="play"
        className="mt-1"
        loading={pending}
        disabled={pending || hasVoice === null}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await startQuizAction({ kind, hasVoice: hasVoice === true });
            if ("error" in r) setError(r.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Starting…" : "Start"}
      </Button>
      {error && (
        <p role="alert" className="m-0 text-meta font-bold text-again">
          {error}
        </p>
      )}
    </Card>
  );
}
