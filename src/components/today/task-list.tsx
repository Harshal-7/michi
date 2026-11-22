"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { ICONS } from "@/components/shell/nav";
import { Icon } from "@/components/ui/icon";
import type { TaskRow } from "@/lib/planner/today";

import { markTask } from "./actions";

/** The task-row icons from the canvas: done, up next, to do, and skipped (a dash in the ring). */
export function StateIcon({ state, next, size = 24 }: { state: TaskRow["state"]; next: boolean; size?: number }) {
  if (state === "done") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Done" className="shrink-0 text-good">
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="var(--surface)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (next) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Up next" className="shrink-0 text-accent">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={state === "skipped" ? "Skipped" : "To do"} className="shrink-0 text-ink2">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {state === "skipped" && <path d="M8 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
    </svg>
  );
}

const quiet = "inline-flex min-h-11 items-center rounded-btn border border-line bg-surface px-4 text-sm font-semibold no-underline";

/** "64 cards · 9 min · must-do" on a phone; the laptop shows minutes in their own column. */
function meta(row: TaskRow, withMinutes: boolean) {
  const minutes = row.minutes > 0 ? `${row.minutes} min` : null;
  return [row.detail, row.note ?? (withMinutes ? minutes : null), row.must ? "must-do" : null].filter(Boolean).join(" · ");
}

/** Today's tasks (Today, TodayWeb): ticks, the Start button on the next one, and done or skip by hand. */
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
  const act = (key: string, mark: "done" | "skipped" | null) =>
    startTransition(async () => {
      try {
        await markTask(date, key, mark);
        setError(null);
        setOpen(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "That didn't save. Try again.");
      }
    });

  return (
    <section aria-labelledby="tasks-title" className="flex flex-col gap-1.5 rounded-card bg-surface p-3 shadow-card laptop:p-4">
      <div className="flex items-baseline justify-between px-1 laptop:px-1.5">
        <h2 id="tasks-title" className="m-0 font-head text-[17px] laptop:text-[19px]">
          Today&apos;s tasks
        </h2>
        <p className="m-0 text-xs text-ink2 laptop:hidden">
          {plannedMinutes} of {budgetMinutes} min
        </p>
        <p className="m-0 hidden text-[13px] text-ink2 laptop:block">
          {done} of {rows.length} done
        </p>
      </div>
      {error && (
        <p role="alert" className="m-0 px-1 text-[13px] font-semibold text-again">
          {error}
        </p>
      )}
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {rows.map((row) => {
          const finished = row.state !== "todo";
          const canAct = row.state === "todo" || row.marked;
          const panel = `task-${row.key.replace(/[^a-z0-9]/gi, "-")}`;
          return (
            <li key={row.key} className={`flex flex-col rounded-card px-2.5 py-[9px] laptop:px-3 laptop:py-2.5 ${row.next ? "bg-surface shadow-hero" : ""}`}>
              <div className="flex items-center gap-3 laptop:gap-3.5">
                <StateIcon state={row.state} next={row.next} />
                <div className="flex min-w-0 flex-auto flex-col gap-px">
                  <p className={`m-0 text-[15px] font-semibold laptop:text-[15.5px] ${finished ? "text-ink2" : ""}`}>{row.title}</p>
                  <p className="m-0 text-[12.5px] text-ink2 laptop:hidden">{meta(row, true)}</p>
                  <p className="m-0 hidden text-[13px] text-ink2 laptop:block">{meta(row, false)}</p>
                </div>
                {row.minutes > 0 && <span className="hidden shrink-0 text-[13px] text-ink2 laptop:inline">{row.minutes} min</span>}
                {row.next && (
                  <Link
                    href={row.href}
                    className="inline-flex min-h-10 shrink-0 items-center rounded-btn bg-accent px-4 text-sm font-bold text-on-accent no-underline laptop:px-[18px]"
                  >
                    Start
                  </Link>
                )}
                {canAct && (
                  <button
                    type="button"
                    aria-expanded={open === row.key}
                    aria-controls={panel}
                    aria-label={`More for ${row.title}`}
                    onClick={() => setOpen(open === row.key ? null : row.key)}
                    className="-mr-1.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full border-none bg-transparent text-ink2"
                  >
                    <Icon d={ICONS.more} size={22} stroke={3} />
                  </button>
                )}
              </div>
              {open === row.key && (
                <div id={panel} className="flex flex-wrap gap-2 pt-2 pl-9 laptop:pl-[38px]">
                  {row.state === "todo" && !row.next && (
                    <Link href={row.href} className={quiet}>
                      Start
                    </Link>
                  )}
                  {row.state === "todo" && (
                    <>
                      <button type="button" disabled={pending} onClick={() => act(row.key, "done")} className={`${quiet} disabled:opacity-60`}>
                        Mark done
                      </button>
                      <button type="button" disabled={pending} onClick={() => act(row.key, "skipped")} className={`${quiet} disabled:opacity-60`}>
                        Skip today
                      </button>
                    </>
                  )}
                  {row.marked && row.state !== "todo" && (
                    <button type="button" disabled={pending} onClick={() => act(row.key, null)} className={`${quiet} disabled:opacity-60`}>
                      {row.state === "done" ? "Not done after all" : "Undo skip"}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
