import type { Metadata } from "next";
import Link from "next/link";

import { ICONS } from "@/components/shell/nav";
import { Icon } from "@/components/ui/icon";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { getDb } from "@/db/client";
import { requireSignedIn } from "@/lib/auth/session";
import { formatLong, formatShort, studyDate, weekOf } from "@/lib/day";
import { formatMinutes } from "@/lib/planner/today";

import { deleteMinutes } from "./actions";
import { datableDays, listMinutes } from "./data";
import { isLoggableKind, KIND_LABELS, SKILL_LABELS } from "./kinds";
import { MinutesForm } from "./minutes-form";

export const metadata: Metadata = { title: "Add minutes" };

/**
 * The minutes log: listening, speaking, reading and the rest, by kind and skill. Today's
 * listening, speaking and reading tasks tick themselves from these. Built from F_Log's parts.
 */
export default async function MinutesPage({ searchParams }: PageProps<"/log/minutes">) {
  await requireSignedIn();
  const { kind } = await searchParams;
  const today = studyDate();
  const week = weekOf(today);
  const entries = await listMinutes(getDb(), week.start, week.end);
  const totals = { listening: 0, speaking: 0, reading: 0 };
  for (const e of entries) {
    if (e.kind !== "class" && e.skill in totals) totals[e.skill as keyof typeof totals] += e.minutes;
  }
  const days = datableDays(today).map((d, i) => ({ value: d, label: i === 0 ? "Today" : i === 1 ? "Yesterday" : formatShort(d, today) }));
  const initialKind = isLoggableKind(kind) ? kind : "listening";

  return (
    <>
      <Link href="/log" className="-mb-1 inline-flex min-h-11 items-center gap-1 self-start text-[13px] font-semibold text-ink2 no-underline">
        <Icon d={ICONS.chevronLeft} size={16} stroke={1.8} />
        Log
      </Link>
      <PageHeader kicker={formatLong(today)} title="Add minutes" />
      <MinutesForm initialKind={initialKind} days={days} />

      <section aria-labelledby="week-title" className="flex flex-col gap-2.5 rounded-card bg-surface p-3.5 shadow-card">
        <div className="flex items-baseline justify-between">
          <h2 id="week-title" className="m-0 text-[13px] font-bold">
            This week
          </h2>
          <span className="text-xs text-ink2">
            {formatShort(week.start, today)} – {formatShort(week.end, today)}
          </span>
        </div>
        <dl className="m-0 grid grid-cols-3 gap-2">
          {(["listening", "speaking", "reading"] as const).map((skill) => (
            <div key={skill} className="flex flex-col-reverse gap-0.5">
              <dt className="text-xs text-ink2">{skill}</dt>
              <dd className="m-0 font-head text-[21px]">{formatMinutes(totals[skill])}</dd>
            </div>
          ))}
        </dl>
      </section>

      {entries.length === 0 ? (
        <EmptyState>Nothing logged this week yet.</EmptyState>
      ) : (
        <section aria-label="Entries this week" className="flex flex-col rounded-card bg-surface px-3.5 py-1.5 shadow-card">
          {entries.map((e, i) => (
            <div key={e.id} className={`flex min-h-14 items-center gap-3 py-2 ${i > 0 ? "border-t border-line" : ""}`}>
              <span className="w-[52px] shrink-0 text-xs leading-tight text-ink2">{formatShort(e.date, today)}</span>
              <span className="flex min-w-0 flex-auto flex-col gap-px">
                <span className="truncate text-[14.5px] font-semibold">{e.note || KIND_LABELS[e.kind]}</span>
                <span className="text-[12.5px] text-ink2">
                  {[
                    e.note ? KIND_LABELS[e.kind] : null,
                    SKILL_LABELS[e.skill] !== KIND_LABELS[e.kind] ? SKILL_LABELS[e.skill] : null,
                    e.auto ? "logged by itself" : "logged by hand",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="shrink-0 text-sm font-bold">{e.minutes} min</span>
              {!e.auto && !e.classLogId && (
                <form action={deleteMinutes.bind(null, e.id)}>
                  <button
                    type="submit"
                    aria-label={`Delete ${e.minutes} min of ${KIND_LABELS[e.kind].toLowerCase()} on ${formatShort(e.date, today)}`}
                    className="-mr-2 inline-flex size-11 items-center justify-center rounded-full border-none bg-transparent text-ink2"
                  >
                    <Icon d="M5 7h14 M10 7V4.5h4V7 M7 7l1 13h8l1-13 M10 11v5 M14 11v5" size={18} stroke={1.7} />
                  </button>
                </form>
              )}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
