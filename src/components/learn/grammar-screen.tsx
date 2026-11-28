import { type Level, LEVELS } from "@content/schema";
import type { ReactNode } from "react";

import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/link-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { Mixed } from "@/components/ui/ruby";
import { getDb } from "@/db/client";
import { formatDayMonth, formatLong, isStudyDate, studyDate } from "@/lib/day";
import { pointsFor } from "@/lib/learn/cached";
import { grammarDeckSwitches, nextUnread, pointCounts, READ_THROUGH_LEVEL } from "@/lib/learn/grammar";
import { ROUTES } from "@/lib/planner/day-plan";

import { GrammarList } from "./grammar-list";

export const levelParam = (v: unknown): Level => (typeof v === "string" && (LEVELS as readonly string[]).includes(v) ? (v as Level) : "N5");

/**
 * Grammar (RF_LearnHub's Grammar row): a level's points, how far along they are, and the list to pick
 * a lesson from. A lesson opens on its own page (RF_GrammarLesson, RF_GrammarLessonWeb).
 */
export async function GrammarScreen({ level }: { level: Level }) {
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
    <>
      <header className="flex flex-col gap-1">
        <BackLink href={ROUTES.learn}>Learn</BackLink>
        <PageHeader title="Grammar" sub={formatLong(today)} />
      </header>
      <LinkTabs
        label="Level"
        tabs={LEVELS.map((l) => ({ href: l === "N5" ? "/grammar" : `/grammar?level=${l}`, label: l, note: note(l), current: l === level }))}
      />
      <Card aria-labelledby="grammar-summary" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="grammar-summary" className="m-0 text-lead font-bold">
            {level} grammar · {counts.total} points
          </h2>
          {level === READ_THROUGH_LEVEL && (
            <span className="text-meta whitespace-nowrap text-ink2">{counts.read === counts.total ? "all read" : `${counts.read} read`}</span>
          )}
        </div>
        <div
          role="img"
          aria-label={`Confident ${counts.confident}, learning ${counts.learning}, not started ${counts.not_started}`}
          className="flex h-2.5 overflow-hidden rounded-full bg-track"
        >
          <span className="bg-good" style={{ width: pct(counts.confident) }} />
          <span className="bg-accent" style={{ width: pct(counts.learning) }} />
        </div>
        <p className="m-0 flex flex-wrap gap-x-3.5 gap-y-1.5 text-meta text-ink2">
          <Dot className="bg-good">Confident {counts.confident}</Dot>
          <Dot className="bg-accent">Learning {counts.learning}</Dot>
          <Dot className="border-[1.5px] border-ink3">Not started {counts.not_started}</Dot>
        </p>
        {next && (
          <Button href={`/grammar/${next.id}`} size="lg" full iconEnd="arrow-right">
            <span>
              Continue: <Mixed text={next.pattern} />
            </span>
          </Button>
        )}
      </Card>
      {level !== "N5" && counts.total > 0 && (
        <p className="m-0 text-meta text-ink2">
          {level} points have their meaning and links for now; their examples and checks arrive before {level} starts.
        </p>
      )}
      <GrammarList points={points} nextId={next?.id ?? null} />
    </>
  );
}

function Dot({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={`size-2.25 rounded-full ${className}`} />
      {children}
    </span>
  );
}
