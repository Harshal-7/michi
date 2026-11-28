import { Rabbit } from "@/components/ui/art/rabbit";
import { Hanamaru, type StickerKind, Tick } from "@/components/ui/art/rewards";
import { Scene } from "@/components/ui/art/scene";
import { Button } from "@/components/ui/button";
import { Card, HeroCard } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { SectionTitle } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { StatGrid, StatTile } from "@/components/ui/stat";
import { StickerSheet } from "@/components/ui/sticker-sheet";
import { StreakBadge } from "@/components/ui/streak-badge";
import { daysBetween, formatShort, type StudyDate, weekday } from "@/lib/day";
import type { TodayView } from "@/lib/planner/today";

import { markRegistered, markTask } from "./actions";

/** The sticker each weekday earns, Sunday to Saturday (RF_TodayDone: 木 is the hanamaru). */
const STICKERS: StickerKind[] = ["star-butter", "flower-pink", "leaf-mint", "star-peri", "hanamaru-butter", "usagi-blue", "star-butter"];
const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function stickerDays(view: TodayView): (StickerKind | null)[] {
  return view.stickerDays.map((on, i) => (on ? STICKERS[i] : null));
}

/** The streak as the butter sticker: "6 · day streak · best yet". */
export function Streak({ view, size = "md" }: { view: TodayView; size?: "md" | "sm" }) {
  const { current, best } = view.streak;
  const sub = current === 0 ? "starts with today’s reviews" : current >= best ? "best yet" : `best ${best}`;
  return <StreakBadge count={current} sub={sub} size={size} />;
}

/**
 * The top of Today (RF_Today, RF_TodayWeb): the title, the date and the streak. On the phone the shell
 * puts "+ Add a word" level with the title, so the streak sits on the date's line.
 */
export function TodayHeader({ view, date }: { view: TodayView; date: string }) {
  return (
    <header className="flex flex-col gap-2 laptop:flex-row laptop:items-end laptop:justify-between laptop:gap-6">
      <div className="flex flex-col">
        <h1 className="m-0 flex min-h-12 items-center text-headline font-black laptop:text-display">Today</h1>
        <p className="m-0 text-body text-ink2 max-laptop:hidden">{date}</p>
      </div>
      <div className="flex min-h-10 items-center justify-between gap-3 laptop:hidden">
        <p className="m-0 text-body text-ink2">{date}</p>
        <Streak view={view} size="sm" />
      </div>
      <div className="max-laptop:hidden">
        <Streak view={view} />
      </div>
    </header>
  );
}

/** The goal as one quiet line on the phone: "N5 refresh · 28 days left · mock Sat 26 Dec". */
export function GoalLine({ view }: { view: TodayView }) {
  const { phase, exam, date, phaseMock } = view;
  const parts: string[] = [];
  if (phase?.daysLeft != null) parts.push(`${phase.daysLeft} ${phase.daysLeft === 1 ? "day" : "days"} left`);
  if (phaseMock) parts.push(`mock ${formatShort(phaseMock, date)}`);
  else if (exam) parts.push(exam.days === 0 ? `JLPT ${exam.level} today` : `JLPT ${exam.level} in ${exam.days} ${exam.days === 1 ? "day" : "days"}`);
  if (!phase && parts.length === 0) return null;
  return (
    <p className="m-0 flex items-start gap-2 text-meta text-ink2 laptop:hidden">
      <Icon name="flag" size={18} className="mt-px text-ink3" />
      <span>
        <b className="font-bold text-ink">{phase ? phase.name : "Before the plan"}</b>
        {parts.length > 0 && ` · ${parts.join(" · ")}`}
      </span>
    </p>
  );
}

/**
 * The laptop's goal strip (RF_TodayWeb): the phase as a ruled bar on cover-blue with today's fill, the
 * mock marked on it, and the next exam to the right.
 */
export function GoalStrip({ view }: { view: TodayView }) {
  const { phase, exam, date, phaseMock } = view;
  if (!phase) return null;
  const total = phase.totalDays;
  const mockAt = total && phaseMock ? ((daysBetween(phase.start, phaseMock) + 0.5) / total) * 100 : null;
  return (
    <div className="flex items-end gap-6 max-laptop:hidden">
      <p className="m-0 shrink-0 pb-5.5 text-body">
        <b className="font-black">{phase.name}</b>
        <span className="text-ink2">
          {" "}
          · {phase.daysLeft === null ? `day ${phase.daysGone + 1}` : `${phase.daysLeft} ${phase.daysLeft === 1 ? "day" : "days"} left`}
        </span>
      </p>
      {total !== null ? (
        <div className="relative min-w-0 flex-1">
          <div className="relative h-5 text-caption leading-5 font-bold">
            {mockAt !== null && phaseMock && (
              <span className="absolute pr-2 whitespace-nowrap" style={{ right: `${100 - mockAt}%` }}>
                N5 mock · {formatShort(phaseMock, date)}
              </span>
            )}
          </div>
          <ProgressBar
            size="strip"
            value={Math.min(total, phase.daysGone + 1)}
            max={total}
            label={`${phase.name}: day ${phase.daysGone + 1} of ${total}`}
            className="mt-1"
          />
          {mockAt !== null && (
            <span aria-hidden="true" className="absolute top-1.5 -ml-px h-10.5 w-0.5 rounded-full bg-ink" style={{ left: `${mockAt}%` }} />
          )}
          <div className="mt-1.5 flex justify-between text-caption font-bold text-ink2">
            <span>Today</span>
            {phase.end && <span>Ends {formatShort(phase.end, date)}</span>}
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}
      {exam && (
        <p className="m-0 shrink-0 pb-5.5 text-meta text-ink2">
          {phase.end ? "Then " : ""}JLPT {exam.level} · {formatShort(exam.date, date)}
          {exam.confirmed ? "" : " (expected)"}
        </p>
      )}
    </div>
  );
}

/** Registration for the next JLPT, while it's open: one card with the host's site and "I've registered". */
export function RegistrationCard({ registration }: { registration: NonNullable<TodayView["registration"]> }) {
  const { level, fee, hostUrl } = registration;
  return (
    <Card as="aside" aria-labelledby="register-title" className="flex flex-col gap-2">
      <h2 id="register-title" className="m-0 text-lead font-black">
        Register for JLPT {level}
      </h2>
      <p className="m-0 text-body text-ink2">Registration runs through your city’s host, about {fee}. Places can fill in the first days.</p>
      <div className="flex flex-wrap items-center gap-2">
        {hostUrl ? (
          <a
            href={hostUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-pill border-[1.5px] border-line-strong bg-surface px-4 text-meta font-bold text-ink no-underline hover:bg-surface2"
          >
            Open your host’s site
            <Icon name="external" size={16} />
          </a>
        ) : (
          <Button variant="secondary" size="sm" href="/settings#registration">
            Choose your city’s host
          </Button>
        )}
        <form action={markRegistered.bind(null, level)}>
          <Button variant="text" size="sm" type="submit">
            I’ve registered
          </Button>
        </form>
      </div>
    </Card>
  );
}

/** The current level's lists as bars (RF_TodayWeb's "N5 progress"); a finished one fills in red pencil. */
export function ProgressCard({ view }: { view: TodayView }) {
  return (
    <Card aria-labelledby="level-title" className="px-5.5 pt-3 pb-5.5">
      <SectionTitle id="level-title" link={{ href: "/progress", label: "Details" }}>
        {view.level} progress
      </SectionTitle>
      <div className="mt-1.5 grid grid-cols-2 gap-x-5.5 gap-y-4">
        {view.bars.map((b) => (
          <div key={b.key} className="flex min-w-0 flex-col">
            <div className="flex items-center justify-between gap-2 text-meta">
              <span className="font-bold">{b.label}</span>
              <span className="text-ink2 tabular-nums">{b.value}</span>
            </div>
            <ProgressBar
              value={b.pct}
              max={100}
              ticks={false}
              tone={b.pct >= 100 ? "hanamaru" : "accent"}
              label={`${b.label}: ${b.value}, ${b.note}`}
              className="mt-2"
            />
            <span className="mt-1 text-caption text-ink2">{b.note}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** This week (RF_TodayWeb): the 日–土 sticker sheet and the week's numbers. */
export function WeekCard({ view }: { view: TodayView }) {
  const days = stickerDays(view);
  const earned = days.filter(Boolean).length;
  return (
    <Card aria-labelledby="week-title" className="px-5.5 pt-3 pb-5">
      <SectionTitle id="week-title" meta={`${earned} of 7 days`}>
        This week
      </SectionTitle>
      <div className="mt-2.5">
        <StickerSheet days={days} today={weekday(view.date)} />
      </div>
      <StatGrid cols={3} className="mt-4.5 border-t-[1.5px] border-line pt-4">
        {view.week.map((w) => (
          <StatTile key={w.label} value={w.value} label={w.label} />
        ))}
      </StatGrid>
    </Card>
  );
}

/** What's next on the calendar (a mock, the first class, the next phase, the exam). */
export function ComingUpCard({ view }: { view: TodayView }) {
  if (view.comingUp.length === 0) return null;
  return (
    <Card aria-labelledby="coming-title" className="px-5.5 pt-3 pb-5">
      <SectionTitle id="coming-title">Coming up</SectionTitle>
      <ul className="m-0 mt-1 flex list-none flex-col gap-2.5 p-0">
        {view.comingUp.map((e) => (
          <li key={e.title} className="flex items-start gap-3">
            <Icon name="calendar" size={20} className="mt-0.5 text-ink3" />
            <span className="flex flex-col">
              <span className="text-body font-bold">{e.title}</span>
              <span className="text-meta text-ink2">{e.when}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const OPTIONAL = [
  { label: "Read an NHK Easy article", href: "/log/minutes?kind=reading" },
  { label: "Shadow 5 sentences", href: "/log/minutes?kind=shadowing" },
  { label: "Log some anime", href: "/log/minutes?kind=immersion" },
];

/**
 * Done for today (RF_TodayDone): the farmhouse with every window lit, the red-pencil hanamaru round
 * "Done for today" with よくできました, today's sticker landing on the week's sheet, and one row that
 * opens what you did, tomorrow and some optional extras.
 */
export function DoneCards({ view }: { view: TodayView }) {
  const done = view.done!;
  const today = weekday(view.date);
  const days = stickerDays(view);
  const earned = days.filter(Boolean).length;
  const finished = done.items.filter((d) => d.result !== "skipped").length;
  return (
    <section aria-labelledby="plan-title" className="flex flex-col">
      <SectionTitle id="plan-title" meta={`${view.status.done} of ${view.rows.length} done`}>
        Today’s plan
      </SectionTitle>
      <HeroCard aria-label="Done for today" className="mt-1.5" art={<Scene lit={6} />} artClassName="h-32 laptop:h-43" bodyClassName="relative gap-0 px-4 pt-2 pb-4">
        <div aria-hidden="true" className="absolute inset-0 flex flex-col gap-6.75 pt-7.5">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="h-px shrink-0 bg-paper-rule" />
          ))}
        </div>
        <div className="relative flex justify-center">
          <div className="relative h-50.5 w-60 shrink-0">
            <Hanamaru width={240} className="absolute top-0 left-0" />
            <h2 className="absolute inset-x-0 top-0 m-0 grid h-43 place-items-center text-center text-headline font-black">
              Done for
              <br />
              today
            </h2>
            <p lang="ja" className="absolute inset-x-0 top-42 m-0 -rotate-4 text-center font-ja text-title whitespace-nowrap text-hanamaru">
              よくできました
            </p>
          </div>
        </div>
        <div className="relative mt-3.5 flex items-baseline justify-between">
          <h3 className="m-0 text-lead font-black">{WEEKDAY[today]}’s sticker</h3>
          <span className="text-meta text-ink2">{earned} of 7 days</span>
        </div>
        <div className="relative mt-11">
          <StickerSheet days={days} today={today} size={34} dropping={days[today] !== null} />
        </div>
      </HeroCard>
      <details className="group mt-1.5">
        <summary className="flex min-h-15 cursor-pointer list-none items-center gap-3.5 rounded-btn py-1.5 hover:bg-surface2 [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="relative size-6.5 shrink-0 rounded-box border-2 border-cover-blue">
            <span className="absolute -top-2.5 -left-0.5">
              <Tick size={32} />
            </span>
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-body font-bold">
              {finished === done.items.length ? `All ${finished} tasks done` : `${finished} of ${done.items.length} tasks done`}
            </span>
            <span className="text-meta text-ink2">about {done.minutes} min today · see what you did</span>
          </span>
          <Icon name="chevron-down" size={20} className="text-ink3 transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-4 pt-2 pb-2">
          <ul aria-label="What you did" className="m-0 flex list-none flex-col p-0">
            {done.items.map((d) => (
              <li key={d.key} className="flex min-h-12 items-center gap-3 border-b-[1.5px] border-line last:border-b-0">
                <Icon name={d.result === "skipped" ? "arrow-right" : "check"} size={18} className={d.result === "skipped" ? "text-ink3" : "text-good"} />
                <span className="flex-1 text-body">{d.title}</span>
                <span className="text-meta text-ink2">{d.result}</span>
                {d.marked && (
                  <form action={markTask.bind(null, view.date, d.key, null)}>
                    <Button variant="text" size="sm" type="submit" aria-label={`Undo ${d.title}`}>
                      Undo
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {view.tomorrow && (
            <div className="rounded-btn bg-surface2 px-3.5 py-3">
              <p className="m-0 text-meta font-bold">Tomorrow · {view.tomorrow.weekday}</p>
              <p className="m-0 text-meta">{view.tomorrow.summary}</p>
              {view.tomorrow.note && <p className="m-0 text-meta text-ink2">{view.tomorrow.note}</p>}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <p className="m-0 text-meta font-bold text-ink2">Still have energy? (optional)</p>
            <div className="flex flex-wrap gap-2">
              {OPTIONAL.map((o) => (
                <Button key={o.href} variant="secondary" size="sm" href={o.href}>
                  {o.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}

/** Exam day: the exam is the only task. */
export function ExamDayCard({ level, date }: { level: string; date: StudyDate }) {
  return (
    <Card aria-labelledby="exam-title" className="flex flex-col items-center gap-2 py-6 text-center">
      <Rabbit pose="cheering" size={150} />
      <h2 id="exam-title" className="m-0 text-headline font-black">
        {level === "other" ? "Exam day" : `JLPT ${level} today`}
      </h2>
      <p className="m-0 text-body text-ink2">Nothing else is planned for {formatShort(date)}. Good luck.</p>
      <p lang="ja" className="m-0 font-ja text-title">
        がんばってください。
      </p>
    </Card>
  );
}
