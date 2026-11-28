import { sql } from "drizzle-orm";

import { Card } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/page-header";

import type { Db } from "@/db/client";
import { addDays, daysBetween, formatShort, type StudyDate, weekOf } from "@/lib/day";

export const HEATMAP_WEEKS = 53;
const CELL = 13;
const PITCH = 16;

export type HeatmapDay = { date: StudyDate; reviews: number; future: boolean };

/** Reviews per study day for the last 53 Monday-to-Sunday weeks, this one included. */
export async function loadHeatmap(db: Db, today: StudyDate): Promise<HeatmapDay[][]> {
  const start = addDays(weekOf(today).start, -7 * (HEATMAP_WEEKS - 1));
  const result = await db.execute<{ date: string; n: number }>(
    sql`select study_date::text as date, count(*)::int as n from review_logs
      where voided_at is null and study_date >= ${start}::date and study_date <= ${today}::date
      group by 1`,
  );
  const byDate = new Map((result.rows as { date: string; n: number }[]).map((r) => [r.date, r.n]));
  return Array.from({ length: HEATMAP_WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, w * 7 + d);
      return { date, reviews: byDate.get(date) ?? 0, future: daysBetween(today, date) > 0 };
    }),
  );
}

/** Opacity steps from F_Progress, by reviews that day. */
export function heatStep(reviews: number): 0 | 1 | 2 | 3 {
  return reviews <= 0 ? 0 : reviews < 50 ? 1 : reviews < 100 ? 2 : 3;
}
const STEP_STYLE = ["fill-track", "fill-accent opacity-45", "fill-accent opacity-70", "fill-accent"] as const;

/** Days in a row with reviews, ending today (or yesterday, while today is still going). */
export function reviewRun(weeks: HeatmapDay[][], today: StudyDate): { days: number; since: StudyDate | null } {
  const days = weeks.flat().filter((d) => !d.future);
  let i = days.length - 1;
  if (i >= 0 && days[i].date === today && days[i].reviews === 0) i--;
  let run = 0;
  while (i >= 0 && days[i].reviews > 0) {
    run++;
    i--;
  }
  return { days: run, since: run > 0 ? days[i + 1].date : null };
}

/** The year of reviews (F_Progress's study-day grid): weeks as columns, Monday at the top. */
export function Heatmap({ weeks, today }: { weeks: HeatmapDay[][]; today: StudyDate }) {
  const days = weeks.flat().filter((d) => !d.future);
  const total = days.reduce((s, d) => s + d.reviews, 0);
  const active = days.filter((d) => d.reviews > 0).length;
  const run = reviewRun(weeks, today);
  const width = HEATMAP_WEEKS * PITCH - (PITCH - CELL);
  const height = 7 * PITCH - (PITCH - CELL);
  const summary =
    total === 0
      ? "No reviews yet. Each day you review fills in a square."
      : run.days > 0 && run.since
        ? `Every day since ${formatShort(run.since, today)}: ${run.days} in a row.`
        : `${total.toLocaleString("en-IN")} reviews on ${active} ${active === 1 ? "day" : "days"}.`;
  return (
    <Card aria-labelledby="heat-title" className="flex flex-col gap-3 pt-3">
      <div className="flex flex-col">
        <SectionTitle id="heat-title">Reviews, last year</SectionTitle>
        <p className="m-0 text-body text-ink2">{summary}</p>
      </div>
      {/* Scrolls sideways on a phone, starting at this week (the right-hand end); fits on a laptop. */}
      <div dir="rtl" className="overflow-x-auto pb-1">
        <div dir="ltr" className="w-max laptop:w-full">
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Reviews per day over the last year: ${total} reviews on ${active} days. ${summary}`}
            className="block laptop:h-auto laptop:w-full"
          >
            {weeks.map((week, w) =>
              week.map((d, i) => (
                <rect
                  key={d.date}
                  x={w * PITCH}
                  y={i * PITCH}
                  width={CELL}
                  height={CELL}
                  rx={3}
                  className={d.future ? "fill-track opacity-35" : STEP_STYLE[heatStep(d.reviews)]}
                >
                  <title>{`${formatShort(d.date, today)}: ${d.reviews} ${d.reviews === 1 ? "review" : "reviews"}`}</title>
                </rect>
              )),
            )}
          </svg>
        </div>
      </div>
      <div aria-hidden="true" className="flex items-center justify-end gap-1.5 text-caption text-ink2">
        <span>Fewer</span>
        {STEP_STYLE.map((c) => (
          <svg key={c} width={CELL} height={CELL} className="block">
            <rect width={CELL} height={CELL} rx={3} className={c} />
          </svg>
        ))}
        <span>More</span>
      </div>
    </Card>
  );
}
