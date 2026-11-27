import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { waitingFrom } from "@/components/quiz/quiz-page";
import { QuizResults } from "@/components/quiz/results";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { studyDate } from "@/lib/day";
import { loadQuiz, missOutcomes } from "@/lib/quiz/store";

export const metadata: Metadata = { title: "Quiz results" };

/** A past quiz's results (F_Quiz). An unfinished one goes back to where it's taken. */
export default async function PastQuizPage({ params }: PageProps<"/practice/history/[id]">) {
  await requireSignedIn();
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const db = getDb();
  const [settings, quiz] = await Promise.all([getSettings(db), loadQuiz(db, id)]);
  if (!quiz) notFound();
  if (quiz.status !== "submitted") redirect(quiz.kind === "daily" ? "/practice/quiz" : "/practice/weekly");
  const today = studyDate();
  const [waiting, outcomes] = await Promise.all([waitingFrom(quiz, today), missOutcomes(db, quiz)]);
  return <QuizResults quiz={quiz} furigana={settings.furigana} back={{ href: "/practice/history", label: "Quiz history" }} waiting={waiting} outcomes={outcomes} />;
}
