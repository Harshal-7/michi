import type { Metadata } from "next";

import {
  ComingUpCard,
  DoneCards,
  ExamDayCard,
  GoalLine,
  GoalStrip,
  ProgressCard,
  RegistrationCard,
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
 * Today (RF_Today, RF_TodayDark, RF_TodayDone, RF_TodayWeb): the date and the streak, the goal as one
 * quiet line, then the plan: the next step on the farmhouse card and the rest as a checklist. Once the
 * plan is all done, the hanamaru and today's sticker. From 1024px the goal becomes a strip and the
 * level's progress and the week sit in a column on the right; on the phone they follow the plan.
 */
export default async function TodayPage() {
  await requireSignedIn();
  const plan = await todaysPlan();
  const view = await loadToday(getDb(), plan);
  const finished = view.status.finished;
  const examDay = plan.mode === "exam_day";

  return (
    <div data-wide className="flex flex-col gap-2 laptop:gap-3.5">
      <TodayHeader view={view} date={formatLong(view.date)} />
      <GoalLine view={view} />
      <GoalStrip view={view} />

      {view.registration && <RegistrationCard registration={view.registration} />}

      <div className="mt-2 flex flex-col gap-6 laptop:mt-1 laptop:grid laptop:grid-cols-[minmax(0,1fr)_352px] laptop:items-start laptop:gap-8">
        <div className="flex min-w-0 flex-col gap-4">
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
        </div>
        <div className="flex min-w-0 flex-col gap-5 laptop:pt-12.5">
          <ProgressCard view={view} />
          <WeekCard view={view} />
          <ComingUpCard view={view} />
        </div>
      </div>
    </div>
  );
}
