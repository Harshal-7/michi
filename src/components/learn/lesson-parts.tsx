"use client";

import { blanks } from "@content/schema";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";

import { changeStatus, markLesson } from "@/app/(app)/grammar/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { SectionTitle } from "@/components/ui/page-header";
import { Mixed, Ruby } from "@/components/ui/ruby";
import { Segmented } from "@/components/ui/segmented";
import type { GrammarStatus, Lesson } from "@/lib/learn/grammar";

const STATUSES: { value: GrammarStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "learning", label: "Learning" },
  { value: "confident", label: "Confident" },
];

/** "Where you are with it" (RF_GrammarLessonWeb): the point's status, saved as you pick it. */
export function StatusChips({ itemId, status }: { itemId: number; status: GrammarStatus }) {
  const [shown, setShown] = useOptimistic(status);
  const [, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-meta font-bold">Where you are with it</p>
      <Segmented
        label="Where you are with it"
        name={`status-${itemId}`}
        value={shown}
        options={STATUSES}
        onChange={(next) =>
          start(async () => {
            setShown(next);
            await changeStatus(itemId, next);
          })
        }
      />
    </div>
  );
}

/** A small stable shuffle, so the server and the browser order the options the same way. */
function seededOrder<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return items
    .map((item, i) => ({ item, key: Math.imul(h ^ (i + 1), 2654435761) >>> 0 }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.item);
}

const answerOf = (ja: string) => blanks(ja)[0] ?? "";

/**
 * The end of a lesson: its check questions, then "I know this" or "Learn it" (decision 6). A
 * missed question turns "I know this" into "Learn it". Marking moves on to the next lesson not
 * read yet.
 */
export function LessonCheck({ lesson, furigana }: { lesson: Pick<Lesson, "id" | "questions" | "status" | "read" | "verdict">; furigana: boolean }) {
  const router = useRouter();
  const [chosen, setChosen] = useState<(string | null)[]>(() => lesson.questions.map(() => null));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [opId] = useState(() => crypto.randomUUID());

  const answers = lesson.questions.flatMap((q, i) => (chosen[i] === null ? [] : [chosen[i] === answerOf(q.ja)]));
  const missed = answers.some((a) => !a);
  const mark = (choice: "known" | "learn") =>
    start(async () => {
      setError(null);
      const result = await markLesson({ opId, itemId: lesson.id, choice, answers });
      if ("error" in result) setError(result.error);
      else router.push(result.next ? `/grammar/${result.next}` : "/grammar");
    });

  return (
    <>
      {lesson.questions.length > 0 && (
        <Card aria-labelledby="check-yourself" padding="none" className="flex flex-col gap-4 px-5.5 pt-3 pb-5">
          <SectionTitle id="check-yourself" meta={`${answers.length} of ${lesson.questions.length}`}>
            Check yourself
          </SectionTitle>
          {lesson.questions.map((q, qi) => {
            const answer = answerOf(q.ja);
            const pick = chosen[qi];
            const options = seededOrder([answer, ...q.wrong], q.slug);
            return (
              <div key={q.slug} className={`flex flex-col ${qi ? "border-t-[1.5px] border-line pt-4" : ""}`}>
                <p className="m-0 font-ja text-title leading-ja font-semibold whitespace-break-spaces">
                  <Ruby text={q.ja} furigana={furigana} blank={pick === null ? "hide" : "fill"} />
                </p>
                <p className="m-0 text-meta text-ink2">{q.en}</p>
                <div className="mt-3.5 grid grid-cols-2 gap-2">
                  {options.map((option) => {
                    const right = option === answer;
                    const edge =
                      pick !== null && right
                        ? "border-2 border-good"
                        : pick === option
                          ? "border-2 border-again"
                          : "border-[1.5px] border-line-strong enabled:hover:bg-surface2";
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={pick === option}
                        disabled={pick !== null}
                        onClick={() => setChosen((c) => c.map((v, i) => (i === qi ? option : v)))}
                        className={`flex min-h-13 items-center justify-center gap-1.5 rounded-btn bg-surface px-3 text-ink transition-colors duration-120 ${edge}`}
                      >
                        <Ruby text={option} furigana={furigana} className="font-ja text-lead font-semibold" />
                        {pick !== null && right && <Icon name="check" size={18} stroke={2.4} className="text-good" />}
                        {pick === option && !right && <Icon name="close" size={18} stroke={2.4} className="text-again" />}
                      </button>
                    );
                  })}
                </div>
                {pick !== null && (
                  <p className="m-0 mt-2.5 text-meta text-ink2" aria-live="polite">
                    <span className={`font-bold ${pick === answer ? "text-good" : "text-again"}`}>{pick === answer ? "Right." : "Not quite."}</span>{" "}
                    {q.explain && <Mixed text={q.explain} furigana={furigana} />}
                  </p>
                )}
              </div>
            );
          })}
        </Card>
      )}

      <section aria-label="Mark this lesson" className="flex flex-col gap-2">
        {lesson.read && (
          <p className="m-0 text-meta text-ink2">
            Marked {lesson.verdict === "known" && lesson.status === "confident" ? "“I know this”" : "“Learn it”"}. You can change it.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant={missed ? "primary" : "secondary"} size="lg" full disabled={pending} onClick={() => mark("learn")}>
            Learn it
          </Button>
          <Button variant={missed ? "secondary" : "primary"} size="lg" full disabled={pending} onClick={() => mark("known")}>
            I know this
          </Button>
        </div>
        <p className="m-0 text-meta text-ink2" aria-live="polite">
          {error ??
            (missed
              ? "You missed a check question, so this goes to the front of your new cards either way."
              : "I know this: it comes back in your reviews in a few weeks. Learn it: it goes to the front of your new cards.")}
        </p>
      </section>
    </>
  );
}
