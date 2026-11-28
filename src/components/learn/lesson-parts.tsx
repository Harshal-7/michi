"use client";
// design-lint: legacy

import { blanks } from "@content/schema";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";

import { changeStatus, markLesson } from "@/app/(app)/grammar/actions";
import { Mixed, Ruby } from "@/components/ui/ruby";
import { Icon } from "@/components/ui/icon";
import type { GrammarStatus, Lesson } from "@/lib/learn/grammar";

const CHECK = "M5 12.5l4.5 4.5L19 7";
const CROSS = "M6 6l12 12 M18 6L6 18";
const STATUSES: { key: GrammarStatus; label: string }[] = [
  { key: "not_started", label: "Not started" },
  { key: "learning", label: "Learning" },
  { key: "confident", label: "Confident" },
];

/** F_GrammarPoint's status control. */
export function StatusChips({ itemId, status }: { itemId: number; status: GrammarStatus }) {
  const [shown, setShown] = useOptimistic(status);
  const [, start] = useTransition();
  return (
    <div role="group" aria-label="Status" className="grid grid-cols-3 gap-1 rounded-btn bg-surface2 p-1">
      {STATUSES.map((s) => (
        <button
          key={s.key}
          type="button"
          aria-pressed={shown === s.key}
          onClick={() =>
            start(async () => {
              setShown(s.key);
              await changeStatus(itemId, s.key);
            })
          }
          className={`min-h-10 rounded-btn border-none text-[13.5px] ${shown === s.key ? "bg-accent font-bold text-on-accent" : "bg-transparent font-medium text-ink2"}`}
        >
          {s.label}
        </button>
      ))}
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

  const solid = "min-h-[50px] flex-1 rounded-btn border-none bg-accent px-4 text-[15px] font-bold text-on-accent disabled:opacity-60";
  const quiet = "min-h-[50px] flex-1 rounded-btn border border-line bg-surface px-4 text-[15px] font-semibold text-ink disabled:opacity-60";

  return (
    <>
      {lesson.questions.length > 0 && (
        <section className="flex flex-col gap-3 rounded-card bg-surface px-3.5 py-3 shadow-card">
          <h2 className="m-0 text-[13px] font-bold">Check yourself</h2>
          {lesson.questions.map((q, qi) => {
            const answer = answerOf(q.ja);
            const pick = chosen[qi];
            const options = seededOrder([answer, ...q.wrong], q.slug);
            return (
              <div key={q.slug} className={`flex flex-col gap-2 ${qi ? "border-t border-line pt-3" : ""}`}>
                <p className="m-0 font-card text-lg leading-[1.85]">
                  <Ruby text={q.ja} furigana={furigana} blank={pick === null ? "hide" : "fill"} />
                </p>
                <p className="m-0 text-[13px] text-ink2">{q.en}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {options.map((option) => {
                    const right = option === answer;
                    const style =
                      pick !== null && right ? "border-2 border-good" : pick === option ? "border-2 border-again" : "border border-line";
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={pick === option}
                        disabled={pick !== null}
                        onClick={() => setChosen((c) => c.map((v, i) => (i === qi ? option : v)))}
                        className={`flex min-h-12 items-center justify-between gap-1.5 rounded-btn bg-surface px-3.5 text-left ${style}`}
                      >
                        <Ruby text={option} furigana={furigana} className="text-[15px] font-semibold" />
                        {pick !== null && right && <Icon d={CHECK} size={16} stroke={2.2} className="shrink-0 text-good" />}
                        {pick === option && !right && <Icon d={CROSS} size={16} stroke={2.2} className="shrink-0 text-again" />}
                      </button>
                    );
                  })}
                </div>
                {pick !== null && (
                  <p className="m-0 text-[13px] text-ink2" aria-live="polite">
                    <span className={`font-bold ${pick === answer ? "text-good" : "text-again"}`}>{pick === answer ? "Right." : "Not quite."}</span>{" "}
                    {q.explain && <Mixed text={q.explain} furigana={furigana} />}
                  </p>
                )}
              </div>
            );
          })}
        </section>
      )}

      <section className="flex flex-col gap-2">
        {lesson.read && (
          <p className="m-0 text-[13px] text-ink2">
            Marked {lesson.verdict === "known" && lesson.status === "confident" ? "“I know this”" : "“Learn it”"}. You can change it.
          </p>
        )}
        <div className="flex gap-2">
          <button type="button" disabled={pending} onClick={() => mark("learn")} className={missed ? solid : quiet}>
            Learn it
          </button>
          <button type="button" disabled={pending} onClick={() => mark("known")} className={missed ? quiet : solid}>
            I know this
          </button>
        </div>
        <p className="m-0 text-xs text-ink2" aria-live="polite">
          {error ??
            (missed
              ? "You missed a check question, so this goes to the front of your new cards either way."
              : "I know this: it comes back in your reviews in a few weeks. Learn it: it goes to the front of your new cards.")}
        </p>
      </section>
    </>
  );
}
