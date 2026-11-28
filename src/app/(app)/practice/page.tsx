import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Rabbit } from "@/components/ui/art/rabbit";
import { Button } from "@/components/ui/button";
import { Chip, COVER_BG, type Cover } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { List, ListRow } from "@/components/ui/list-row";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { addDays, formatLong, formatShort, studyDate, weekOf } from "@/lib/day";
import { makeCalendar, mockOn } from "@/lib/planner/calendar";
import { ROUTES } from "@/lib/planner/day-plan";
import { QUIZ_MINUTES, WEEKLY_TEST_MINUTES } from "@/lib/planner/plan";
import { loadExceptions } from "@/lib/planner/store";
import { findQuiz, loadMistakes, openTestWeek, type Quiz, testSunday, WEEKLY_OPEN_DAYS } from "@/lib/quiz/store";
import { LISTEN_DRILL_LENGTH, QUIZ_LENGTH } from "@/lib/quiz/types";
import { listShadowingSets, promptOfTheDay } from "@/lib/speaking/practice";

export const metadata: Metadata = { title: "Practice" };

/** The kanji tile at the start of a Practice row: 42px, a cover colour, the kanji in Klee One. */
function Glyph({ kanji, cover }: { kanji: string; cover: Cover }) {
  return (
    <span lang="ja" aria-hidden="true" className={`grid size-10.5 shrink-0 place-items-center rounded-btn font-ja text-title text-on-cover ${COVER_BG[cover]}`}>
      {kanji}
    </span>
  );
}

/** The next mock test within about four months, from the planner's calendar. */
function nextMock(cal: ReturnType<typeof makeCalendar>, today: string) {
  for (let d = today, i = 0; i < 130; i++, d = addDays(d, 1)) {
    const level = mockOn(cal, d);
    if (level) return { level, date: d };
  }
  return null;
}

type Row = { meta: string; href?: string; trailing?: ReactNode; must: boolean };

/** A quiz row: started, in progress or done. The one solid Start sits on whatever is next. */
function quizRow(quiz: Quiz | null, href: string, results: string, isNext: boolean, notStarted: string): Row {
  if (quiz?.status === "submitted") {
    return { meta: `Done · ${quiz.score} / ${quiz.total}`, href: results, must: false };
  }
  const label = quiz ? "Continue" : "Start";
  const meta = quiz ? `${quiz.questions.filter((q) => q.correct !== null).length} of ${quiz.total} answered` : notStarted;
  if (isNext) {
    return {
      meta,
      must: true,
      trailing: (
        <Button icon="play" href={href}>
          {label}
        </Button>
      ),
    };
  }
  return { meta, href, must: true };
}

/**
 * Practice (RF_PracticeHub): the quizzes and tests, then speaking and listening, then the way to the
 * games. The one solid Start goes on whatever is next.
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

  const d = quizRow(daily, ROUTES.quiz, ROUTES.quiz, next === "daily", `${QUIZ_LENGTH.daily} questions · about ${QUIZ_MINUTES} min`);
  const w: Row = week
    ? quizRow(
        weekly,
        ROUTES.weeklyTest,
        weekly ? `/practice/history/${weekly.id}` : ROUTES.weeklyTest,
        next === "weekly",
        `Open to ${formatShort(addDays(testSunday(week), WEEKLY_OPEN_DAYS), today)} · ${QUIZ_LENGTH.weekly} questions · ${WEEKLY_TEST_MINUTES} min`,
      )
    : {
        meta: `Sundays · ${QUIZ_LENGTH.weekly} questions · ${WEEKLY_TEST_MINUTES} min`,
        href: ROUTES.weeklyTest,
        must: false,
        trailing: <Chip kind="soon">{formatShort(testSunday(weekOf(today).start), today)}</Chip>,
      };
  const m: Row =
    mistakes.length === 0
      ? { meta: "Nothing waiting", must: false }
      : next === "mistakes"
        ? {
            meta: `${mistakes.length} waiting from the last week’s quizzes`,
            must: false,
            trailing: (
              <Button icon="play" href={ROUTES.mistakes}>
                Start
              </Button>
            ),
          }
        : { meta: `${mistakes.length} waiting from the last week’s quizzes`, href: ROUTES.mistakes, must: false };

  const drills = [
    { kanji: "聞", cover: "aqua" as const, title: "Listen and choose", meta: `${LISTEN_DRILL_LENGTH} words read aloud · about 4 min`, href: ROUTES.listen },
    { kanji: "話", cover: "peri" as const, title: "Speaking prompt", meta: prompt ? `${prompt.prompt} · 10 min` : "No prompts yet", href: ROUTES.speaking },
    {
      kanji: "影",
      cover: "butter" as const,
      title: "Shadowing",
      meta: sets.length ? `${sets.length} sets · 8 to 10 sentences each` : "No sets yet",
      href: ROUTES.shadowing,
    },
  ];

  return (
    <div data-wide className="flex flex-col gap-4 wide:grid wide:grid-cols-2 wide:items-start wide:gap-x-8 wide:gap-y-5">
      <div className="wide:col-span-2">
        <PageHeader sub={formatLong(today)} title="Practice" />
      </div>

      <section aria-labelledby="tests-title">
        <SectionTitle id="tests-title" link={{ href: ROUTES.quizHistory, label: "History" }}>
          Quizzes and tests
        </SectionTitle>
        <List aria-labelledby="tests-title">
          <ListRow
            lead={{ node: <Glyph kanji="問" cover="mint" /> }}
            title="Daily quiz"
            chip={d.must && <Chip cover="butter">must-do</Chip>}
            meta={d.meta}
            href={d.href}
            trailing={d.trailing}
          />
          <ListRow
            lead={{ node: <Glyph kanji="週" cover="blue" /> }}
            title="Weekly test"
            meta={w.meta}
            href={w.href}
            trailing={w.trailing}
            chevron={week !== null && !w.trailing}
          />
          <ListRow lead={{ node: <Glyph kanji="直" cover="pink" /> }} title="Mistakes review" meta={m.meta} href={m.href} trailing={m.trailing} />
          <ListRow
            lead={{ node: <Glyph kanji="模" cover="lilac" /> }}
            title="Mock tests"
            meta={
              mock
                ? `${mock.level} mock ${formatShort(mock.date, today)} · coming later`
                : "Timed tests and book scores · coming later"
            }
            trailing={<Chip kind="soon">Soon</Chip>}
          />
        </List>
      </section>

      <div className="flex flex-col gap-4">
        <section aria-labelledby="speaking-title">
          <SectionTitle id="speaking-title">Speaking and listening</SectionTitle>
          <List aria-labelledby="speaking-title">
            {drills.map((dr) => (
              <ListRow key={dr.title} lead={{ node: <Glyph kanji={dr.kanji} cover={dr.cover} /> }} title={dr.title} meta={dr.meta} href={dr.href} />
            ))}
          </List>
        </section>

        <Link
          href="/play"
          className="relative flex min-h-21 items-center gap-1.5 overflow-hidden rounded-card bg-cover-cobalt py-3 pr-4 pl-1.5 text-on-cobalt no-underline shadow-card"
        >
          <span className="-mb-3.5 shrink-0">
            <Rabbit pose="cheering" size={110} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lead font-black">Games</span>
            <span className="block text-meta">Kana game and more, open to friends</span>
          </span>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-on-cobalt text-cover-cobalt">
            <Icon name="arrow-right" size={20} />
          </span>
        </Link>
      </div>
    </div>
  );
}
