import { Sticker } from "@/components/ui/art/rewards";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { SectionTitle } from "@/components/ui/page-header";
import { Mixed, Ruby } from "@/components/ui/ruby";
import { formatLong } from "@/lib/day";
import type { Quiz, QuizQuestion } from "@/lib/quiz/store";
import { QUIZ_TITLE, TYPE_LABEL, TYPE_SHORT } from "@/lib/quiz/types";

import { AskedJa } from "./question-view";
import { Dots } from "./quiz-runner";

/** Score chips by type: "Kanji reading 1/2", red when any was missed. */
export function TypeChips({ scores }: { scores: { label: string; right: number; asked: number }[] }) {
  return (
    <ul aria-label="Score by type" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {scores.map((s) => (
        <li
          key={s.label}
          className={`inline-flex h-7.5 items-center gap-1.5 rounded-chip px-2.5 text-meta leading-none ${s.right < s.asked ? "bg-again-soft text-on-cover" : "bg-surface2 text-ink"}`}
        >
          <span>{s.label}</span>
          <b className="font-black">
            {s.right}/{s.asked}
          </b>
        </li>
      ))}
    </ul>
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

/** One mistake with its right answer (RF_QuizResults' "To review"). */
export function MistakeCard({ q, furigana }: { q: Pick<QuizQuestion, "asked" | "answer">; furigana: boolean }) {
  const { asked } = q;
  const isJa = asked.optionsLang === "ja";
  const right = asked.options[asked.answer];
  const answerText = (t: string) => (isJa ? <Ruby text={t} furigana={furigana} className="font-ja text-body" /> : <span>{t}</span>);
  return (
    <li className="border-b-[1.5px] border-line pt-2.5 pb-3 last:border-b-0">
      <p className="m-0 text-meta font-bold text-ink2">{TYPE_LABEL[asked.type]}</p>
      {asked.full ? (
        <p className="m-0 font-ja text-title leading-ja">
          <Ruby text={asked.full.ja} furigana={furigana} />
        </p>
      ) : asked.ja ? (
        <p className="m-0 font-ja text-title leading-ja">
          <AskedJa ja={asked.ja} furigana={furigana} filled />
        </p>
      ) : asked.say ? (
        <p className="m-0 font-ja text-title leading-ja">
          <Ruby text={asked.say} furigana={false} />
        </p>
      ) : null}
      {asked.en && !asked.full && <p className="m-0 text-body">{asked.en}</p>}
      <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-meta font-bold">
        <span className="inline-flex items-center gap-1 text-again">
          <Icon name="close" size={16} stroke={2.4} />
          You: {q.answer ? answerText(q.answer) : "—"}
        </span>
        <span className="inline-flex items-center gap-1 text-good">
          <Icon name="check" size={16} stroke={2.4} />
          Answer: {answerText(right)}
        </span>
      </p>
      {asked.explain && (
        <p className="m-0 mt-0.5 text-meta text-ink2">
          <Mixed text={asked.explain} furigana={furigana} />
        </p>
      )}
      {asked.full?.en && <p className="m-0 mt-0.5 text-meta text-ink2">{asked.full.en}</p>}
    </li>
  );
}

/**
 * A finished quiz (RF_QuizResults): the score with a star sticker, a dot per question, scores by type,
 * and every mistake with its right answer. `waiting` is how many the mistakes review still has.
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
      <header className="flex flex-col">
        <BackLink href={back.href}>{back.label}</BackLink>
        <h1 className="m-0 mt-1.5 text-headline font-black">{QUIZ_TITLE[quiz.kind]}</h1>
        <p className="m-0 text-body text-ink2">
          {formatLong(quiz.studyDate)}
          {took !== null && took <= 120 ? ` · took ${took} min` : ""}
        </p>
      </header>

      <Card aria-label="Score" className="relative mt-1 flex flex-col">
        {pct >= 80 && (
          <span className="absolute -top-3.5 right-4.5">
            <Sticker kind="star-butter" size={44} rotate={8} />
          </span>
        )}
        <div className="flex items-baseline gap-3">
          <p className="m-0 text-display leading-none font-black">
            {score}
            <span className="text-title text-ink2"> / {total}</span>
          </p>
          <Chip kind="count" size="lg">
            {pct}%
          </Chip>
        </div>
        <div className="mt-3.5">
          <Dots marks={quiz.questions.map((q) => (q.correct ? "good" : "again"))} label={`${score} right, ${total - score} wrong`} />
        </div>
        <p className="m-0 mt-3 text-meta text-ink2">{mistakeLine(mistakes.length, outcomes)}</p>
        <div className="mt-3">
          <TypeChips scores={scoresByType(quiz.questions)} />
        </div>
      </Card>

      {mistakes.length > 0 && (
        <section aria-labelledby="to-review">
          <SectionTitle id="to-review" meta={`${mistakes.length} missed`}>
            To review
          </SectionTitle>
          <ul className="m-0 list-none p-0">
            {mistakes.map((q) => (
              <MistakeCard key={q.id} q={q} furigana={furigana} />
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-2">
        {waiting > 0 && (
          <Button size="lg" full href="/practice/mistakes">
            Review the {waiting === 1 ? "mistake" : `${waiting} mistakes`} now
          </Button>
        )}
        <Button variant="secondary" full icon="arrow-left" href="/">
          Back to Today
        </Button>
      </div>
    </>
  );
}
