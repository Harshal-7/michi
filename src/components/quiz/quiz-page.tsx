// design-lint: legacy
import type { ReactNode } from "react";

import { BackLink } from "@/components/ui/back-link";
import { getDb } from "@/db/client";
import type { Settings } from "@/lib/settings/schema";
import { loadMistakes, missOutcomes, type Quiz } from "@/lib/quiz/store";
import { QUIZ_TITLE } from "@/lib/quiz/types";

import { QuizRunner } from "./quiz-runner";
import { QuizResults } from "./results";

/** How many of a quiz's mistakes the mistakes review still has. */
export async function waitingFrom(quiz: Quiz, today: string): Promise<number> {
  const ids = new Set(quiz.questions.map((q) => q.id));
  return (await loadMistakes(getDb(), today)).filter((m) => ids.has(m.id)).length;
}

/** A quiz page: results once it's submitted, the questions while it's open, else the start. */
export async function QuizPage({
  quiz,
  settings,
  today,
  title,
  kicker,
  start,
}: {
  quiz: Quiz | null;
  settings: Settings;
  today: string;
  title: string;
  kicker: ReactNode;
  start: ReactNode;
}) {
  if (quiz?.status === "submitted") {
    const [waiting, outcomes] = await Promise.all([waitingFrom(quiz, today), missOutcomes(getDb(), quiz)]);
    return <QuizResults quiz={quiz} furigana={settings.furigana} back={{ href: "/practice", label: "Practice" }} waiting={waiting} outcomes={outcomes} />;
  }
  if (quiz) {
    return (
      <QuizRunner
        assessmentId={quiz.id}
        title={QUIZ_TITLE[quiz.kind]}
        furigana={settings.furigana}
        voice={settings.voice}
        questions={quiz.questions.map((q) => ({
          id: q.id,
          asked: q.asked,
          chosen: q.answer === null ? null : Math.max(0, q.asked.options.indexOf(q.answer)),
        }))}
      />
    );
  }
  return (
    <>
      <header className="flex flex-col gap-0.5">
        <BackLink href="/practice">Practice</BackLink>
        <h1 className="m-0 font-head text-[28px] leading-[1.15]">{title}</h1>
        <p className="m-0 text-[13px] text-ink2">{kicker}</p>
      </header>
      {start}
    </>
  );
}
