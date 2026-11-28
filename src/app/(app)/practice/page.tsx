// design-lint: legacy
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { addDays, formatLong, formatShort, studyDate, weekOf } from "@/lib/day";
import { makeCalendar, MOCK_MINUTES, mockOn } from "@/lib/planner/calendar";
import { ROUTES } from "@/lib/planner/day-plan";
import { QUIZ_MINUTES, WEEKLY_TEST_MINUTES } from "@/lib/planner/plan";
import { loadExceptions } from "@/lib/planner/store";
import { findQuiz, loadMistakes, openTestWeek, type Quiz, testSunday, WEEKLY_OPEN_DAYS } from "@/lib/quiz/store";
import { LISTEN_DRILL_LENGTH, QUIZ_LENGTH } from "@/lib/quiz/types";
import { listShadowingSets, promptOfTheDay } from "@/lib/speaking/practice";

export const metadata: Metadata = { title: "Practice" };

const card = "flex flex-col rounded-card bg-surface shadow-card";
const solid = "inline-flex min-h-11 items-center justify-center self-start rounded-btn bg-accent px-[18px] text-sm font-bold text-on-accent no-underline";
const soft = "inline-flex min-h-10 shrink-0 items-center rounded-btn bg-accent-soft px-4 text-[13px] font-bold text-ink no-underline";
const textLink = "mt-1 inline-flex min-h-8 items-center self-start text-[13px] font-semibold text-ink2";

/** The next mock test within about four months, from the planner's calendar. */
function nextMock(cal: ReturnType<typeof makeCalendar>, today: string) {
  for (let d = today, i = 0; i < 130; i++, d = addDays(d, 1)) {
    const level = mockOn(cal, d);
    if (level) return { level, date: d };
  }
  return null;
}

type QuizCard = { big: string; status: ReactNode; action: ReactNode; hero: boolean };

function quizCard(quiz: Quiz | null, href: string, results: string, solidNext: boolean, notStarted: string, doneLabel: string): QuizCard {
  if (quiz?.status === "submitted") {
    return {
      big: `${quiz.score} / ${quiz.total}`,
      status: <p className="m-0 text-[12.5px] font-bold text-good">{doneLabel}</p>,

      action: (
        <Link href={results} className={textLink}>
          See results
        </Link>
      ),
      hero: false,
    };
  }
  if (quiz) {
    const answered = quiz.questions.filter((q) => q.correct !== null).length;
    return {
      big: `${answered} / ${quiz.total}`,
      status: <p className="m-0 text-[12.5px] text-ink2">answered so far</p>,
      action: solidNext ? (
        <Link href={href} className={`${solid} mt-1`}>
          Continue
        </Link>
      ) : (
        <Link href={href} className={textLink}>
          Continue
        </Link>
      ),
      hero: solidNext,
    };
  }
  return {
    big: notStarted,
    status: null,
    action: solidNext ? (
      <Link href={href} className={`${solid} mt-1`}>
        Start
      </Link>
    ) : (
      <Link href={href} className={textLink}>
        Start
      </Link>
    ),
    hero: solidNext,
  };
}

/**
 * Practice (F_Practice): the daily quiz and weekly test, mock tests (round 4), speaking and
 * listening, and the mistakes review. The one solid button goes on whatever is next.
 */
export default async function PracticePage() {
  await requireSignedIn();
  const db = getDb();
  const today = studyDate();
  const week = openTestWeek(today);
  const settings = await getSettings(db);
  const [exceptions, daily, weekly, mistakes, prompt, sets] = await Promise.all([
    loadExceptions(db),
    findQuiz(db, "daily", today),
    week ? findQuiz(db, "weekly", week) : Promise.resolve(null),
    loadMistakes(db, today),
    promptOfTheDay(db, today, settings),
    listShadowingSets(db),
  ]);
  const mock = nextMock(makeCalendar(settings, exceptions), today);

  const dailyDone = daily?.status === "submitted";
  const weeklyDue = week !== null && weekly?.status !== "submitted";
  const next: "daily" | "weekly" | "mistakes" | null = !dailyDone ? "daily" : weeklyDue ? "weekly" : mistakes.length > 0 ? "mistakes" : null;

  const d = quizCard(daily, ROUTES.quiz, ROUTES.quiz, next === "daily", `${QUIZ_LENGTH.daily} questions`, "Done today");
  const w: QuizCard = week
    ? quizCard(weekly, ROUTES.weeklyTest, weekly ? `/practice/history/${weekly.id}` : ROUTES.weeklyTest, next === "weekly", "Open now", "Done")
    : { big: formatShort(testSunday(weekOf(today).start), today), status: null, action: null, hero: false };

  const drills = [
    {
      title: "Speaking prompt",
      meta: prompt ? `${prompt.prompt} · 10 min` : "No prompts yet",
      href: ROUTES.speaking,
    },
    {
      title: "Shadowing",
      meta: sets.length ? `${sets.length} sets · 8 to 10 sentences each` : "No sets yet",
      href: ROUTES.shadowing,
    },
    { title: "Listen and choose", meta: `${LISTEN_DRILL_LENGTH} words read aloud · about 4 min`, href: ROUTES.listen },
  ];

  const quizCards = (
    <div className="grid grid-cols-2 gap-2.5">
      <section className={`${card} gap-1 p-3.5 ${d.hero ? "shadow-hero" : ""}`}>
        <h2 className="m-0 text-[13px] font-bold">Daily quiz</h2>
        <p className="m-0 font-head text-2xl">{d.big}</p>
        {d.status ?? <p className="m-0 text-[12.5px] text-ink2">about {QUIZ_MINUTES} min</p>}
        {d.action}
      </section>
      <section className={`${card} gap-1 p-3.5 ${w.hero ? "shadow-hero" : ""}`}>
        <h2 className="m-0 text-[13px] font-bold">Weekly test</h2>
        <p className="m-0 font-head text-2xl">{w.big}</p>
        {w.status ?? <p className="m-0 text-[12.5px] text-ink2">{QUIZ_LENGTH.weekly} questions on this week</p>}
        <p className="m-0 mt-1 text-[12.5px] text-ink2">
          {week ? `Open to ${formatShort(addDays(testSunday(week), WEEKLY_OPEN_DAYS), today)} · ${WEEKLY_TEST_MINUTES} min` : "Opens Sunday, stays open to Wed"}
        </p>
        {w.action}
      </section>
    </div>
  );

  const mistakesCard = (
    <section className={`${card} flex-row items-center gap-3 p-3.5 ${next === "mistakes" ? "shadow-hero" : ""}`}>
      <div className="flex min-w-0 flex-auto flex-col gap-0.5">
        <h2 className="m-0 text-[15px] font-bold">Mistakes review</h2>
        <p className="m-0 text-[12.5px] text-ink2">
          {mistakes.length === 0 ? "Nothing waiting" : `${mistakes.length} waiting from the last week's quizzes`}
        </p>
      </div>
      {mistakes.length > 0 && (
        <Link
          href={ROUTES.mistakes}
          className={
            next === "mistakes"
              ? "inline-flex min-h-11 shrink-0 items-center rounded-btn bg-accent px-[18px] text-sm font-bold text-on-accent no-underline"
              : soft
          }
        >
          Start
        </Link>
      )}
    </section>
  );

  return (
    <div data-wide className="flex flex-col gap-3 wide:grid wide:grid-cols-2 wide:items-start wide:gap-5">
      <div className="flex flex-col gap-3 wide:col-span-2">
        <PageHeader kicker={formatLong(today)} title="Practice" />
      </div>

      <div className="flex flex-col gap-3 wide:gap-5">
        {quizCards}
        {mistakesCard}
        <Link href={ROUTES.quizHistory} className="inline-flex min-h-9 items-center self-center text-[13px] font-semibold text-ink2 wide:self-start">
          Quiz history
        </Link>
      </div>

      <div className="flex flex-col gap-3 wide:gap-5">
        <section className={`${card} px-3.5 py-2`}>
          <h2 className="m-0 mt-1.5 mb-0.5 text-[13px] font-bold">Speaking and listening</h2>
          {drills.map((dr, i) => (
            <div key={dr.title} className={`flex items-center gap-3 py-2.5 ${i ? "border-t border-line" : ""}`}>
              <div className="flex min-w-0 flex-auto flex-col gap-px">
                <p className="m-0 text-[15px] font-semibold">{dr.title}</p>
                <p className="m-0 text-[12.5px] text-ink2">{dr.meta}</p>
              </div>
              <Link href={dr.href} className={soft}>
                Start
              </Link>
            </div>
          ))}
        </section>

        <section className={`${card} gap-0.5 p-3.5`}>
          <h2 className="m-0 text-[13px] font-bold">Mock tests</h2>
          {mock && (
            <p className="m-0 text-[15px] font-semibold">
              {mock.level} mock · {formatShort(mock.date, today)}
            </p>
          )}
          <p className="m-0 text-[12.5px] text-ink2">
            {mock ? `Vocabulary, grammar and reading · ${MOCK_MINUTES[mock.level]} min · ` : ""}Mock tests and scores from books come in round 4.
          </p>
        </section>
      </div>
    </div>
  );
}
