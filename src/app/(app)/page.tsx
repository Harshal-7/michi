import type { Metadata } from "next";

import {
  ComingUpCard,
  DoneCards,
  ExamCard,
  ExamDayCard,
  PhaseCard,
  ProgressCard,
  RegistrationCard,
  StreakCard,
  TodayHeader,
  WeekCard,
} from "@/components/today/cards";
import { TaskList } from "@/components/today/task-list";
import { getDb } from "@/db/client";
import { requireSignedIn } from "@/lib/auth/session";
import { formatLong } from "@/lib/day";
import { loadToday } from "@/lib/planner/today";
import { todaysPlan } from "@/lib/planner/today-plan";

export const metadata: Metadata = { title: "Today" };

/**
 * Today (Today, TodayWeb, F_TodayDone; dark from the tokens). The phone shows the streak in the
 * header and the cards in one column; from 1024px the page widens to the laptop board's two
 * columns, with the streak, "Coming up" and the minutes column.
 */
export default async function TodayPage() {
  await requireSignedIn();
  const plan = await todaysPlan();
  const view = await loadToday(getDb(), plan);
  const finished = view.status.finished;
  const examDay = plan.mode === "exam_day";

  return (
    <div data-wide className="flex flex-col gap-3 laptop:gap-5">
      <TodayHeader view={view} kicker={formatLong(view.date)} showStreak={!finished} />

      <div className={`grid grid-cols-2 gap-2.5 laptop:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] laptop:gap-4 ${finished ? "max-laptop:hidden" : ""}`}>
        <PhaseCard view={view} />
        <ExamCard view={view} />
        <StreakCard view={view} />
      </div>

      {view.registration && <RegistrationCard registration={view.registration} />}

      <div className="flex flex-col gap-3 laptop:flex-row laptop:flex-wrap laptop:items-start laptop:gap-4">
        <div className="flex min-w-0 flex-col gap-3 laptop:flex-[3_1_420px] laptop:gap-4">
          {examDay ? (
            <ExamDayCard level={view.examToday ?? "other"} date={view.date} />
          ) : finished ? (
            <DoneCards view={view} />
          ) : (
            <TaskList
              date={view.date}
              rows={view.rows}
              plannedMinutes={view.plannedMinutes}
              budgetMinutes={plan.budgetMinutes}
              done={view.status.done}
            />
          )}
          <ComingUpCard view={view} />
        </div>
        <div className="flex min-w-0 flex-col gap-3 laptop:flex-[2_1_300px] laptop:gap-4">
          <ProgressCard view={view} />
          <WeekCard view={view} />
        </div>
      </div>
    </div>
  );
}
