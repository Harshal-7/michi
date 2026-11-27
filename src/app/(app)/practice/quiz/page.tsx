import type { Metadata } from "next";

import { QuizPage } from "@/components/quiz/quiz-page";
import { QuizStart } from "@/components/quiz/quiz-runner";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { formatLong, studyDate } from "@/lib/day";
import { QUIZ_MINUTES } from "@/lib/planner/plan";
import { findQuiz } from "@/lib/quiz/store";
import { QUIZ_LENGTH } from "@/lib/quiz/types";

export const metadata: Metadata = { title: "Daily quiz" };

/** Today's 10-question quiz (F_QuizQuestion), then its results (F_Quiz). */
export default async function DailyQuizPage() {
  await requireSignedIn();
  const db = getDb();
  const today = studyDate();
  const [settings, quiz] = await Promise.all([getSettings(db), findQuiz(db, "daily", today)]);
  return (
    <QuizPage
      quiz={quiz}
      settings={settings}
      today={today}
      title="Daily quiz"
      kicker={formatLong(today)}
      start={<QuizStart kind="daily" count={QUIZ_LENGTH.daily} minutes={QUIZ_MINUTES} />}
    />
  );
}
