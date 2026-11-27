import Link from "next/link";

import { Mixed, Ruby } from "@/components/ruby";
import { BackLink } from "@/components/learn/tabs";
import { formatLong } from "@/lib/day";
import type { Quiz, QuizQuestion } from "@/lib/quiz/store";
import { QUIZ_TITLE, TYPE_LABEL, TYPE_SHORT } from "@/lib/quiz/types";

import { AskedJa } from "./question-view";
import { Dots } from "./quiz-runner";

const card = "flex flex-col rounded-card bg-surface shadow-card";

/** Score chips by type: "Kanji reading 1/2", red when any was missed. */
export function TypeChips({ scores }: { scores: { label: string; right: number; asked: number }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {scores.map((s) => (
        <span key={s.label} className={`rounded-btn border px-2.5 py-[5px] text-[12.5px] ${s.right < s.asked ? "border-again text-again" : "border-line text-ink"}`}>
          {s.label} <strong>{s.right}/{s.asked}</strong>
        </span>
      ))}
    </div>
  );
}

export function scoresByType(qs: readonly Pick<QuizQuestion, "asked" | "correct">[]) {
  const out = new Map<string, { label: string; right: number; asked: number }>();
  for (const q of qs) {
    const label = TYPE_SHORT[q.asked.type];
    const s = out.get(label) ?? { label, right: 0, asked: 0 };
    s.asked++;
    if (q.correct) s.right++;
    out.set(label, s);
  }
  return [...out.values()];
}

/** "Your 2 mistakes went back into your reviews." Items not started yet go to the front of new cards instead. */
export function mistakeLine(count: number, { reviews, newCards }: { reviews: number; newCards: number }): string {
  if (count === 0) return "No mistakes this time.";
  const these = count === 1 ? "Your mistake" : `Your ${count} mistakes`;
  if (newCards === 0) return `${these} went back into your reviews.`;
  if (reviews === 0) return count === 1 ? "You hadn't started this one, so it goes to the front of your new cards." : "You hadn't started these, so they go to the front of your new cards.";
  return `${reviews} went back into your reviews; ${newCards} you hadn't started ${newCards === 1 ? "goes" : "go"} to the front of your new cards.`;
}

/** One mistake with its right answer (F_Quiz). */
export function MistakeCard({ q, furigana }: { q: Pick<QuizQuestion, "asked" | "answer">; furigana: boolean }) {
  const { asked } = q;
  const isJa = asked.optionsLang === "ja";
  const right = asked.options[asked.answer];
  const answerText = (t: string) => (isJa ? <Ruby text={t} furigana={furigana} className="font-bold" /> : <strong>{t}</strong>);
  return (
    <article className={`${card} gap-1.5 px-3.5 py-3`}>
      <p className="m-0 text-xs font-semibold text-ink2">{TYPE_LABEL[asked.type]}</p>
      {asked.full ? (
        <p className="m-0 font-card text-[19px] leading-[1.5]">
          <Ruby text={asked.full.ja} furigana={furigana} />
        </p>
      ) : asked.ja ? (
        <p className="m-0 font-card text-[19px] leading-[1.5]">
          <AskedJa ja={asked.ja} furigana={furigana} filled />
        </p>
      ) : asked.say ? (
        <p className="m-0 font-card text-[19px] leading-[1.5]">
          <Ruby text={asked.say} furigana={false} />
        </p>
      ) : null}
      {asked.en && !asked.full && <p className="m-0 text-sm">{asked.en}</p>}
      <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[13.5px]">
        <span className="text-again">✕ You: {q.answer ? answerText(q.answer) : "—"}</span>
        <span className="text-good">✓ Answer: {answerText(right)}</span>
      </div>
      {asked.explain && (
        <p className="m-0 text-[12.5px] text-ink2">
          <Mixed text={asked.explain} furigana={furigana} />
        </p>
      )}
      {asked.full?.en && <p className="m-0 text-[12.5px] text-ink2">{asked.full.en}</p>}
    </article>
  );
}

/**
 * A finished quiz (F_Quiz): the score, a dot per question, scores by type, and every mistake with
 * its right answer. `waiting` is how many of these mistakes the mistakes review still has.
 */
export function QuizResults({
  quiz,
  furigana,
  back,
  waiting,
  outcomes,
}: {
  quiz: Quiz;
  furigana: boolean;
  back: { href: string; label: string };
  waiting: number;
  outcomes: { reviews: number; newCards: number };
}) {
  const score = quiz.score ?? quiz.questions.filter((q) => q.correct).length;
  const total = quiz.total || quiz.questions.length;
  const mistakes = quiz.questions.filter((q) => q.correct === false);
  const took = quiz.submittedAt ? Math.max(1, Math.round((quiz.submittedAt.getTime() - quiz.startedAt.getTime()) / 60000)) : null;
  const pct = total ? Math.round((score / total) * 100) : 0;
  return (
    <>
      <header className="flex flex-col gap-0.5">
        <BackLink href={back.href}>{back.label}</BackLink>
        <h1 className="m-0 font-head text-[28px] leading-[1.15]">{QUIZ_TITLE[quiz.kind]}</h1>
        <p className="m-0 text-[13px] text-ink2">
          {formatLong(quiz.studyDate)}
          {took !== null && took <= 120 ? ` · took ${took} min` : ""}
        </p>
      </header>

      <section className={`${card} gap-2.5 px-4 py-3.5`}>
        <div className="flex items-baseline gap-2.5">
          <p className="m-0 font-head text-[46px] leading-none">
            {score}
            <span className="text-[26px] text-ink2"> / {total}</span>
          </p>
          <span className="rounded-btn bg-accent-soft px-2.5 py-[3px] text-[13px] font-bold">{pct}%</span>
        </div>
        <Dots height={8} marks={quiz.questions.map((q) => (q.correct ? "good" : "again"))} label={`${score} right, ${total - score} wrong`} />
        <p className="m-0 text-[13.5px] text-ink2">
          {mistakeLine(mistakes.length, outcomes)}
        </p>
      </section>

      <TypeChips scores={scoresByType(quiz.questions)} />

      {mistakes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="m-0 font-head text-[17px]">Mistakes</h2>
          {mistakes.map((q) => (
            <MistakeCard key={q.id} q={q} furigana={furigana} />
          ))}
        </section>
      )}

      <div className="mt-2 flex flex-col gap-2">
        {waiting > 0 && (
          <Link href="/practice/mistakes" className="flex min-h-[50px] items-center justify-center rounded-btn bg-accent text-[15px] font-bold text-on-accent no-underline">
            Review the {waiting === 1 ? "mistake" : `${waiting} mistakes`} now
          </Link>
        )}
        <Link href="/" className="flex min-h-11 items-center justify-center rounded-btn border border-line text-sm font-semibold text-ink no-underline">
          Back to Today
        </Link>
      </div>
    </>
  );
}
