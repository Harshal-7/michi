import { type Level, LEVELS } from "@content/schema";
import Link from "next/link";
import type { ReactNode } from "react";

import { Mixed } from "@/components/ruby";
import { PageHeader } from "@/components/ui/page";
import { getDb } from "@/db/client";
import { formatDayMonth, formatLong, isStudyDate, studyDate } from "@/lib/day";
import { pointsFor } from "@/lib/learn/cached";
import { grammarDeckSwitches, nextUnread, pointCounts, READ_THROUGH_LEVEL } from "@/lib/learn/grammar";
import { ROUTES } from "@/lib/planner/day-plan";

import { GrammarList } from "./grammar-list";
import { BackLink, LinkTabs } from "./tabs";

export const levelParam = (v: unknown): Level => (typeof v === "string" && (LEVELS as readonly string[]).includes(v) ? (v as Level) : "N5");

/**
 * Grammar (F_Grammar, F_GrammarWeb): the list on a phone, and on a laptop the list beside the
 * lesson. With a lesson selected, a phone shows just the lesson.
 */
export async function GrammarScreen({ level, selectedId, lesson }: { level: Level; selectedId: number | null; lesson: ReactNode }) {
  const today = studyDate();
  const [points, switches] = await Promise.all([pointsFor(level), grammarDeckSwitches(getDb())]);
  const counts = pointCounts(points);
  const next = level === READ_THROUGH_LEVEL ? nextUnread(points) : null;
  const note = (l: Level) => {
    const s = switches[`${l.toLowerCase()}-grammar`];
    if (!s || s.active || (s.unlockOn && s.unlockOn <= today)) return "now";
    return s.unlockOn && isStudyDate(s.unlockOn) ? `from ${formatDayMonth(s.unlockOn)}` : "off";
  };
  const pct = (n: number) => `${counts.total ? (n / counts.total) * 100 : 0}%`;

  return (
    <div data-wide className="flex flex-col gap-3 laptop:grid laptop:grid-cols-[400px_minmax(0,1fr)] laptop:items-start laptop:gap-x-10">
      <div className={`flex flex-col gap-2.5 ${selectedId ? "max-laptop:hidden" : ""}`}>
        <BackLink href={ROUTES.learn}>Learn</BackLink>
        <PageHeader kicker={formatLong(today)} title="Grammar" />
        <LinkTabs
          label="Level"
          tabs={LEVELS.map((l) => ({ href: l === "N5" ? "/grammar" : `/grammar?level=${l}`, label: l, note: note(l), current: l === level }))}
        />
        <section className="flex flex-col gap-2 rounded-card bg-surface px-3.5 py-3 shadow-card">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="m-0 text-[13px] font-bold">
              {level} grammar · {counts.total} points
            </h2>
            {level === READ_THROUGH_LEVEL && <span className="text-xs text-ink2">{counts.read === counts.total ? "all read" : `${counts.read} read`}</span>}
          </div>
          <div
            role="img"
            aria-label={`Confident ${counts.confident}, learning ${counts.learning}, not started ${counts.not_started}`}
            className="flex h-2 overflow-hidden rounded-full bg-track"
          >
            <span className="bg-good" style={{ width: pct(counts.confident) }} />
            <span className="bg-accent" style={{ width: pct(counts.learning) }} />
          </div>
          <p className="m-0 flex flex-wrap gap-3 text-xs text-ink2">
            <Dot className="bg-good">Confident {counts.confident}</Dot>
            <Dot className="bg-accent">Learning {counts.learning}</Dot>
            <Dot className="border border-line bg-track">Not started {counts.not_started}</Dot>
          </p>
          {next && next.id !== selectedId && (
            <Link
              href={`/grammar/${next.id}`}
              className="mt-1 flex min-h-11 items-center justify-center gap-1.5 rounded-btn border border-line bg-surface2 px-3.5 text-[13.5px] font-semibold no-underline"
            >
              Continue reading: <Mixed text={next.pattern} />
            </Link>
          )}
        </section>
        {level !== "N5" && counts.total > 0 && (
          <p className="m-0 text-xs text-ink2">
            {level} points have their meaning and links for now; their examples and checks arrive before {level} starts.
          </p>
        )}
        <GrammarList points={points} nextId={next?.id ?? null} selectedId={selectedId} />
      </div>
      <div className={`flex flex-col gap-3 ${selectedId ? "" : "max-laptop:hidden"}`}>{lesson}</div>
    </div>
  );
}

function Dot({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-[5px]">
      <span aria-hidden="true" className={`size-2 rounded-full ${className}`} />
      {children}
    </span>
  );
}
