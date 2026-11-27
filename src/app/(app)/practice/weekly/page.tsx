import type { Metadata } from "next";
import Link from "next/link";

import { BackLink } from "@/components/learn/tabs";
import { QuizPage } from "@/components/quiz/quiz-page";
import { QuizStart } from "@/components/quiz/quiz-runner";
import { EmptyState } from "@/components/ui/page";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { addDays, formatDayMonth, studyDate, weekOf } from "@/lib/day";
import { WEEKLY_TEST_MINUTES } from "@/lib/planner/plan";
import { findQuiz, openTestWeek, testSunday, WEEKLY_OPEN_DAYS } from "@/lib/quiz/store";
import { QUIZ_LENGTH } from "@/lib/quiz/types";

export const metadata: Metadata = { title: "Weekly test" };

/** The 25-question test on Monday to Sunday: open from Sunday to Wednesday. */
export default async function WeeklyTestPage() {
  await requireSignedIn();
  const db = getDb();
  const today = studyDate();
  const week = openTestWeek(today);
  const settings = await getSettings(db);

  if (!week) {
    const thisWeek = weekOf(today).start;
    const last = await findQuiz(db, "weekly", addDays(thisWeek, -7));
    return (
      <>
        <header className="flex flex-col gap-0.5">
          <BackLink href="/practice">Practice</BackLink>
          <h1 className="m-0 font-head text-[28px] leading-[1.15]">Weekly test</h1>
        </header>
        <EmptyState>
          This week&apos;s test opens on Sunday {formatDayMonth(testSunday(thisWeek))} and stays open to Wednesday. It has {QUIZ_LENGTH.weekly} questions on what you
          studied Monday to Sunday.
        </EmptyState>
        {last?.status === "submitted" && (
          <Link href={`/practice/history/${last.id}`} className="self-start text-[13px] font-semibold text-ink2">
            Last week&apos;s test: {last.score} / {last.total}
          </Link>
        )}
      </>
    );
  }

  const quiz = await findQuiz(db, "weekly", week);
  const closes = addDays(testSunday(week), WEEKLY_OPEN_DAYS);
  return (
    <QuizPage
      quiz={quiz}
      settings={settings}
      today={today}
      title="Weekly test"
      kicker={`Week of ${formatDayMonth(week)} · open to ${formatDayMonth(closes)}`}
      start={
        <QuizStart
          kind="weekly"
          count={QUIZ_LENGTH.weekly}
          minutes={WEEKLY_TEST_MINUTES}
          note="What you started, missed and worked on Monday to Sunday, from kanji readings to grammar."
        />
      }
    />
  );
}
