"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Scene } from "@/components/ui/art/scene";
import { Button } from "@/components/ui/button";
import { HeroCard } from "@/components/ui/card";
import { Chip, type Cover } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { CoverCheck, List } from "@/components/ui/list-row";
import { SectionTitle } from "@/components/ui/page-header";
import type { TaskKind } from "@/lib/planner/day-plan";
import type { TaskRow } from "@/lib/planner/today";

import { markTask } from "./actions";

/** Each kind of task keeps its notebook cover, so a row is recognisable at a glance. */
export const TASK_COVER: Record<TaskKind, Cover> = {
  reviews: "blue",
  quick_check: "butter",
  read_through: "lilac",
  new_items: "peri",
  class: "aqua",
  log_class: "aqua",
  grammar: "lilac",
  daily_quiz: "mint",
  weekly_test: "mint",
  mock: "pink",
  speaking: "pink",
  listening: "aqua",
  reading: "peri",
  work: "butter",
};

const START: Record<TaskKind, string> = {
  reviews: "Start reviews",
  quick_check: "Start the quick check",
  read_through: "Start reading",
  new_items: "Start new items",
  class: "Open the log",
  log_class: "Log the class",
  grammar: "Start grammar",
  daily_quiz: "Start the quiz",
  weekly_test: "Start the test",
  mock: "Open Practice",
  speaking: "Start speaking",
  listening: "Log listening",
  reading: "Log reading",
  work: "Open Work Japanese",
};

/** "10 questions · about 6 min", with the progress or "done" once there is some. */
function meta(row: TaskRow) {
  const minutes = row.minutes > 0 ? `about ${row.minutes} min` : null;
  return [row.detail, row.note ?? minutes].filter(Boolean).join(" · ");
}

type Act = (key: string, mark: "done" | "skipped" | null) => void;

/** Mark done, skip, or undo a mark made by hand: the choices behind a row's checkbox. */
function MarkPanel({ row, id, act, pending }: { row: TaskRow; id: string; act: Act; pending: boolean }) {
  return (
    <div id={id} className="flex flex-wrap gap-2 pb-3 pl-14">
      {row.state === "todo" ? (
        <>
          <Button variant="secondary" size="sm" icon="check" disabled={pending} onClick={() => act(row.key, "done")}>
            Mark done
          </Button>
          <Button variant="secondary" size="sm" disabled={pending} onClick={() => act(row.key, "skipped")}>
            Skip today
          </Button>
        </>
      ) : (
        <Button variant="secondary" size="sm" icon="undo" disabled={pending} onClick={() => act(row.key, null)}>
          {row.state === "done" ? "Not done after all" : "Undo skip"}
        </Button>
      )}
    </div>
  );
}

/**
 * One plan row (RF_Today): the cover checkbox, the title with its chip, the meta line and a chevron.
 * The checkbox is its own button: it opens Mark done / Skip today (or Undo for a hand-made mark);
 * the rest of the row goes to the task.
 */
function PlanRow({ row, open, onToggle, act, pending }: { row: TaskRow; open: boolean; onToggle: () => void; act: Act; pending: boolean }) {
  const canAct = row.state === "todo" || row.marked;
  const panel = `task-${row.key.replace(/[^a-z0-9]/gi, "-")}`;
  const done = row.state === "done";
  const check = <CoverCheck cover={TASK_COVER[row.kind]} state={done ? "done" : "todo"} />;
  return (
    <li className="border-b-[1.5px] border-line last:border-b-0">
      <div className="flex min-h-15 items-center gap-1.5">
        {canAct ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panel}
            aria-label={`${row.title}: ${done ? "done" : row.state === "skipped" ? "skipped" : "mark done or skip"}`}
            onClick={onToggle}
            className="-ml-2.5 grid size-12 shrink-0 place-items-center rounded-btn border-0 bg-transparent p-0 hover:bg-surface2"
          >
            {check}
          </button>
        ) : (
          <span className="-ml-2.5 grid size-12 shrink-0 place-items-center">{check}</span>
        )}
        <Link
          href={row.href}
          className="-mr-2.5 flex min-h-15 min-w-0 flex-1 items-center gap-3 rounded-btn py-1.5 pr-2.5 text-ink no-underline transition-colors duration-120 hover:bg-surface2"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 items-center gap-2">
              <span className={`text-body font-bold ${row.state === "todo" ? "text-ink" : "text-ink2"}`}>{row.title}</span>
              {row.must && row.state === "todo" && <Chip cover="butter">must-do</Chip>}
            </span>
            <span className="text-meta text-ink2">{meta(row)}</span>
          </span>
          <Icon name="chevron-right" size={20} className="text-ink3" />
        </Link>
      </div>
      {open && canAct && <MarkPanel row={row} id={panel} act={act} pending={pending} />}
    </li>
  );
}

/**
 * Today's plan (RF_Today, RF_TodayWeb): the next step as the hero card with the farmhouse on top (a
 * window lights for each finished task), and the rest as a calm checklist. A task can be marked done
 * or skipped by hand from its checkbox; the hero's own task from the line under its button.
 */
export function TaskList({
  date,
  rows,
  plannedMinutes,
  budgetMinutes,
  done,
}: {
  date: string;
  rows: TaskRow[];
  plannedMinutes: number;
  budgetMinutes: number;
  done: number;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const act: Act = (key, mark) =>
    startTransition(async () => {
      try {
        await markTask(date, key, mark);
        setError(null);
        setOpen(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "That didn't save. Try again.");
      }
    });

  const hero = rows.find((r) => r.next) ?? null;
  const rest = rows.filter((r) => r !== hero);
  const heroPanel = hero ? `task-${hero.key.replace(/[^a-z0-9]/gi, "-")}` : "";
  const minutes = budgetMinutes > 0 ? ` · about ${plannedMinutes} of ${budgetMinutes} min` : "";

  return (
    <section aria-labelledby="plan-title" className="flex flex-col">
      <SectionTitle
        id="plan-title"
        meta={
          <>
            {done} of {rows.length} done<span className="max-laptop:hidden">{minutes}</span>
          </>
        }
      >
        Today’s plan
      </SectionTitle>
      {error && (
        <p role="alert" className="m-0 mb-2 text-meta font-bold text-again">
          {error}
        </p>
      )}
      {hero && (
        <HeroCard
          aria-label={`Next step: ${hero.title}`}
          className="mt-1.5"
          art={<Scene lit={Math.min(6, done)} />}
          artClassName="h-34 laptop:h-auto laptop:min-h-43 laptop:aspect-19/6"
          bodyClassName="laptop:flex-row laptop:items-center laptop:gap-5 laptop:px-5.5 laptop:pt-4"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-center gap-2 laptop:gap-2.5">
              <h3 className="m-0 text-title font-black laptop:text-headline">{hero.title}</h3>
              {hero.must && <Chip cover="butter">must-do</Chip>}
            </div>
            <p className="m-0 text-meta text-ink2 laptop:text-body">{meta(hero)}</p>
          </div>
          <div className="flex flex-col gap-1 laptop:w-60 laptop:shrink-0">
            <Button size="lg" icon="play" href={hero.href} full className="mt-1.5 laptop:mt-0">
              {hero.note ? "Keep going" : START[hero.kind]}
            </Button>
            <button
              type="button"
              aria-expanded={open === hero.key}
              aria-controls={heroPanel}
              onClick={() => setOpen(open === hero.key ? null : hero.key)}
              className="inline-flex h-11 items-center justify-center gap-1 self-center rounded-pill border-0 bg-transparent px-3 text-meta font-bold text-ink2 hover:text-ink"
            >
              Mark done or skip
              <Icon name="chevron-down" size={16} />
            </button>
            {open === hero.key && (
              <div id={heroPanel} className="flex flex-wrap justify-center gap-2">
                <Button variant="secondary" size="sm" icon="check" disabled={pending} onClick={() => act(hero.key, "done")}>
                  Mark done
                </Button>
                <Button variant="secondary" size="sm" disabled={pending} onClick={() => act(hero.key, "skipped")}>
                  Skip today
                </Button>
              </div>
            )}
          </div>
        </HeroCard>
      )}
      <List aria-label={hero ? "The rest of today’s plan" : "Today’s plan"} className={hero ? "mt-1" : ""}>
        {rest.map((row) => (
          <PlanRow
            key={row.key}
            row={row}
            open={open === row.key}
            onToggle={() => setOpen(open === row.key ? null : row.key)}
            act={act}
            pending={pending}
          />
        ))}
      </List>
    </section>
  );
}
