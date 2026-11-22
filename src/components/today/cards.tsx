import Link from "next/link";
import type { ReactNode } from "react";

import { formatShort, type StudyDate } from "@/lib/day";
import type { Bar, TodayView } from "@/lib/planner/today";

import { markRegistered, markTask } from "./actions";
import { StateIcon } from "./task-list";

const card = "rounded-card bg-surface shadow-card";
const quiet = "inline-flex min-h-11 items-center rounded-btn border border-line bg-surface px-4 text-sm font-semibold no-underline";
const TONE: Record<Bar["tone"], string> = { good: "text-good", warn: "text-warn", bad: "text-again" };

/** The red 日 seal with the streak in it (Today, TodayWeb, F_TodayDone). */
export function Stamp({ days, size }: { days: number; size: "sm" | "md" | "lg" }) {
  const box = { sm: "size-[50px]", md: "size-14", lg: "size-[72px]" }[size];
  const num = { sm: "text-lg", md: "text-xl", lg: "text-[26px]" }[size];
  return (
    <p
      aria-hidden="true"
      className={`m-0 flex shrink-0 -rotate-6 flex-col items-center justify-center rounded-full border-2 border-accent font-head leading-none text-accent ${box}`}
    >
      <span className={`font-bold ${num}`}>{days}</span>
      <span lang="ja" className={`font-bold ${size === "lg" ? "text-[13px]" : "text-[11px]"}`}>
        日
      </span>
    </p>
  );
}

function streakLines(view: TodayView): { title: string; sub: string } {
  const { current, best, thisWeek } = view.streak;
  if (current === 0) return { title: "No streak yet", sub: "do today's reviews to start one" };
  const bestNote = current >= best ? "your best yet" : `best ${best} days`;
  return {
    title: `${current}-day streak`,
    sub: `${bestNote} · ${thisWeek} ${thisWeek === 1 ? "day" : "days"} this week`,
  };
}

/** The page header: date and title; on a phone the streak sits on the right, on a laptop the minutes. */
export function TodayHeader({ view, kicker, showStreak }: { view: TodayView; kicker: string; showStreak: boolean }) {
  const { title, sub } = streakLines(view);
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 laptop:items-end">
      <div className="flex flex-col gap-0.5">
        <p className="m-0 text-[13px] text-ink2 laptop:text-sm">
          {kicker}
          {view.phase && <span className="hidden laptop:inline"> · {view.phase.name}</span>}
        </p>
        <h1 className="m-0 font-head text-[30px] leading-[1.15] laptop:text-[38px] laptop:leading-[1.1]">Today</h1>
      </div>
      {showStreak && (
        <div className="flex items-center gap-2.5 laptop:hidden">
          <div className="flex flex-col items-end gap-0.5 text-right">
            <p className="m-0 text-xs font-semibold">{title}</p>
            <p className="m-0 text-xs text-ink2">{sub}</p>
          </div>
          <Stamp days={view.streak.current} size="sm" />
        </div>
      )}
      {view.plan.budgetMinutes > 0 && (
        <p className="m-0 hidden text-sm text-ink2 laptop:block">
          {view.plannedMinutes} of {view.plan.budgetMinutes} minutes planned
        </p>
      )}
    </header>
  );
}

function SmallCard({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`${card} flex flex-col gap-1 p-3 laptop:gap-1.5 laptop:px-[18px] laptop:py-4 ${className}`}>
      <h2 className="m-0 text-xs font-semibold text-ink2 laptop:text-[13px]">{title}</h2>
      {children}
    </section>
  );
}

const big = "m-0 font-head text-[22px] leading-[1.2] laptop:text-[26px]";
const small = "m-0 text-xs text-ink2 laptop:text-[13px]";

export function PhaseCard({ view }: { view: TodayView }) {
  const { phase, date } = view;
  if (!phase) return <SmallCard title="Before the plan">{<p className={small}>The N5 refresh hasn&apos;t started yet.</p>}</SmallCard>;
  const pct = phase.totalDays ? Math.round((phase.daysGone / phase.totalDays) * 100) : 0;
  return (
    <SmallCard title={phase.name}>
      <p className={big}>{phase.daysLeft === null ? `day ${phase.daysGone + 1}` : `${phase.daysLeft} ${phase.daysLeft === 1 ? "day" : "days"} left`}</p>
      {phase.totalDays !== null && (
        <div role="img" aria-label={`${phase.daysGone} of ${phase.totalDays} days gone`} className="h-1.5 overflow-hidden rounded-full bg-track">
          <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      )}
      <p className={small}>
        {phase.end ? `ends ${formatShort(phase.end, date)}` : `since ${formatShort(phase.start, date)}`}
        {view.phaseMock && <span className="hidden laptop:inline"> · N5 mock on {formatShort(view.phaseMock, date)}</span>}
      </p>
    </SmallCard>
  );
}

export function ExamCard({ view }: { view: TodayView }) {
  const { exam, date } = view;
  if (!exam) return <SmallCard title="JLPT">{<p className={small}>No exam ahead in your settings.</p>}</SmallCard>;
  const when = formatShort(exam.date, date);
  const register = view.registerNote;
  return (
    <SmallCard title={`JLPT ${exam.level}`}>
      <p className={big}>{exam.days === 0 ? "today" : `${exam.days} ${exam.days === 1 ? "day" : "days"}`}</p>
      <p className={`${small} laptop:hidden`}>{when}</p>
      <p className={`${small} laptop:hidden`}>{exam.confirmed ? "confirmed date" : "expected date"}</p>
      <p className={`${small} hidden laptop:block`}>
        {when} ({exam.confirmed ? "confirmed" : "expected"}){register && ` · ${register}`}
      </p>
    </SmallCard>
  );
}

export function StreakCard({ view }: { view: TodayView }) {
  const { current, best, forgivenThisWeek } = view.streak;
  const bestNote = current === 0 ? "do today's reviews to start one" : current >= best ? "your best yet" : `best ${best} days`;
  return (
    <section className={`${card} hidden items-center gap-3.5 px-[18px] py-4 laptop:flex`}>
      <Stamp days={current} size="md" />
      <div className="flex flex-col gap-0.5">
        <h2 className="m-0 text-[13px] font-semibold text-ink2">Streak</h2>
        <p className="m-0 font-head text-[22px]">{current === 1 ? "1 day" : `${current} days`}</p>
        <p className="m-0 text-[13px] text-ink2">
          {bestNote} · {forgivenThisWeek ? "rest day used this week" : "rest day still free this week"}
        </p>
      </div>
    </section>
  );
}

export function RegistrationCard({ registration }: { registration: NonNullable<TodayView["registration"]> }) {
  const { level, fee, hostUrl } = registration;
  return (
    <section className={`${card} flex flex-col gap-2 px-3.5 py-3 laptop:px-[18px] laptop:py-4`}>
      <h2 className="m-0 font-head text-[17px] laptop:text-[19px]">Register for JLPT {level}</h2>
      <p className="m-0 text-[13px] leading-normal text-ink2">
        Registration runs through your city&apos;s host, about {fee}. Places can fill in the first days.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {hostUrl ? (
          <a href={hostUrl} target="_blank" rel="noreferrer" className={quiet}>
            Open your host&apos;s site
          </a>
        ) : (
          <Link href="/settings#registration" className={quiet}>
            Choose your city&apos;s host
          </Link>
        )}
        <form action={markRegistered.bind(null, level)}>
          <button type="submit" className="min-h-11 border-none bg-transparent px-2 text-sm font-semibold text-ink2 underline underline-offset-2">
            I&apos;ve registered
          </button>
        </form>
      </div>
    </section>
  );
}

export function ProgressCard({ view }: { view: TodayView }) {
  return (
    <section className={`${card} flex flex-col gap-2.5 px-3.5 py-3 laptop:gap-3 laptop:px-[18px] laptop:py-4`}>
      <div className="flex items-baseline justify-between">
        <h2 className="m-0 font-head text-[17px] laptop:text-[19px]">{view.level} progress</h2>
        <Link href="/progress" className="text-xs text-ink2 laptop:text-[13px]">
          Details
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-x-[18px] gap-y-2.5 laptop:gap-x-5 laptop:gap-y-3">
        {view.bars.map((b) => (
          <div key={b.key} className="flex min-w-0 flex-col gap-1">
            <div className="flex justify-between gap-1.5 text-[12.5px] laptop:text-[13px]">
              <span className="font-semibold">{b.label}</span>
              <span className="text-ink2">{b.value}</span>
            </div>
            <div
              role="img"
              aria-label={`${b.label}: ${b.value}`}
              className="h-[5px] overflow-hidden rounded-full bg-track laptop:h-1.5"
            >
              <div className="h-full bg-accent" style={{ width: `${b.pct}%` }} />
            </div>
            <span className={`text-[11.5px] font-semibold laptop:text-xs ${TONE[b.tone]}`}>{b.note}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function WeekCard({ view }: { view: TodayView }) {
  return (
    <section className={`${card} flex flex-col gap-2.5 px-3.5 py-3 laptop:px-[18px] laptop:py-4`}>
      <h2 className="m-0 font-head text-[17px] laptop:text-[19px]">This week</h2>
      <dl className="m-0 grid grid-cols-3 gap-3">
        {view.week.map((w) => (
          <div key={w.label} className="flex flex-col-reverse gap-0.5">
            <dt className="text-xs leading-snug text-ink2">{w.label}</dt>
            <dd className="m-0 font-head text-[20px]">{w.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ComingUpCard({ view }: { view: TodayView }) {
  if (view.comingUp.length === 0) return null;
  return (
    <section className={`${card} hidden flex-col gap-2 px-[18px] py-3.5 laptop:flex`}>
      <h2 className="m-0 font-head text-[17px]">Coming up</h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2.5 text-[13.5px]">
        {view.comingUp.map((e) => (
          <p key={e.title} className="m-0 flex flex-col gap-0.5">
            <strong>{e.title}</strong>
            <span className="text-ink2">{e.when}</span>
          </p>
        ))}
      </div>
    </section>
  );
}

const OPTIONAL = [
  { label: "Read an NHK Easy article", href: "/log/minutes?kind=reading" },
  { label: "Shadow 5 sentences", href: "/log/minutes?kind=shadowing" },
  { label: "Log some anime", href: "/log/minutes?kind=immersion" },
];

/** F_TodayDone: all done, what you did, tomorrow, and optional extras. */
export function DoneCards({ view }: { view: TodayView }) {
  const done = view.done!;
  return (
    <>
      <section className="flex items-center gap-4 rounded-card bg-surface px-[18px] py-5 shadow-hero">
        <Stamp days={view.streak.current} size="lg" />
        <div className="flex flex-col gap-1">
          <h2 className="m-0 font-head text-[22px]">All done for today</h2>
          <p className="m-0 text-sm text-ink2">
            {done.minutes} minutes · your streak is now {view.streak.current === 1 ? "1 day" : `${view.streak.current} days`}
          </p>
          <p lang="ja" className="m-0 font-card text-base">
            おつかれさまでした。
          </p>
        </div>
      </section>
      <section className={`${card} flex flex-col gap-0.5 px-3.5 py-3`}>
        <h2 className="m-0 mb-1 text-[13px] font-bold">What you did</h2>
        {done.items.map((d) => (
          <div key={d.key} className="flex min-h-[30px] items-center gap-2.5 text-sm">
            <StateIcon state={d.result === "skipped" ? "skipped" : "done"} next={false} size={18} />
            <span className="flex-auto">{d.title}</span>
            <span className="text-ink2">{d.result}</span>
            {d.marked && (
              <form action={markTask.bind(null, view.date, d.key, null)}>
                <button
                  type="submit"
                  aria-label={`Undo ${d.title}`}
                  className="min-h-11 border-none bg-transparent px-1 text-[13px] font-semibold text-ink2 underline underline-offset-2"
                >
                  Undo
                </button>
              </form>
            )}
          </div>
        ))}
      </section>
      {view.tomorrow && (
        <section className={`${card} flex flex-col gap-1 px-3.5 py-3`}>
          <h2 className="m-0 text-[13px] font-bold">Tomorrow · {view.tomorrow.weekday}</h2>
          <p className="m-0 text-sm">{view.tomorrow.summary}</p>
          {view.tomorrow.note && <p className="m-0 text-[12.5px] text-ink2">{view.tomorrow.note}</p>}
        </section>
      )}
      <section className="flex flex-col gap-2">
        <h2 className="m-0 text-[13px] font-bold">Still have energy? (optional)</h2>
        <div className="flex flex-wrap gap-2">
          {OPTIONAL.map((o) => (
            <Link key={o.href} href={o.href} className={quiet}>
              {o.label}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

/** Exam day: the exam is the only task. */
export function ExamDayCard({ level, date }: { level: string; date: StudyDate }) {
  return (
    <section className="flex flex-col gap-1 rounded-card bg-surface px-[18px] py-5 shadow-hero">
      <h2 className="m-0 font-head text-[22px]">{level === "other" ? "Exam day" : `JLPT ${level} today`}</h2>
      <p className="m-0 text-sm text-ink2">Nothing else is planned for {formatShort(date)}. Good luck.</p>
      <p lang="ja" className="m-0 font-card text-base">
        がんばってください。
      </p>
    </section>
  );
}
