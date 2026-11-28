import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { List, ListRow } from "@/components/ui/list-row";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { StatGrid, StatTile } from "@/components/ui/stat";
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
 * listening, speaking and reading tasks tick themselves from these. Built from the shared parts.
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
      <PageHeader back={{ href: "/log", label: "Log" }} sub={formatLong(today)} title="Add minutes" />
      <MinutesForm initialKind={initialKind} days={days} />

      <Card aria-labelledby="week-title" className="pt-3">
        <SectionTitle id="week-title" meta={`${formatShort(week.start, today)} – ${formatShort(week.end, today)}`}>
          This week
        </SectionTitle>
        <StatGrid cols={3} className="mt-1">
          {(["listening", "speaking", "reading"] as const).map((skill) => (
            <StatTile key={skill} value={formatMinutes(totals[skill])} label={skill} />
          ))}
        </StatGrid>
      </Card>

      {entries.length === 0 ? (
        <EmptyState>Nothing logged this week yet.</EmptyState>
      ) : (
        <section aria-labelledby="entries-title">
          <SectionTitle id="entries-title">Entries this week</SectionTitle>
          <List aria-labelledby="entries-title">
            {entries.map((e) => (
              <ListRow
                key={e.id}
                lead={{ node: <span className="w-13 shrink-0 text-meta text-ink2">{formatShort(e.date, today)}</span> }}
                title={e.note || KIND_LABELS[e.kind]}
                meta={[
                  e.note ? KIND_LABELS[e.kind] : null,
                  SKILL_LABELS[e.skill] !== KIND_LABELS[e.kind] ? SKILL_LABELS[e.skill] : null,
                  e.auto ? "logged by itself" : "logged by hand",
                ]
                  .filter(Boolean)
                  .join(" · ")}
                trailing={
                  <span className="flex items-center gap-1">
                    <span className="text-body font-black whitespace-nowrap">{e.minutes} min</span>
                    {!e.auto && !e.classLogId && (
                      <form action={deleteMinutes.bind(null, e.id)} className="-mr-2">
                        <IconButton
                          type="submit"
                          icon="trash"
                          label={`Delete ${e.minutes} min of ${KIND_LABELS[e.kind].toLowerCase()} on ${formatShort(e.date, today)}`}
                          className="text-ink2"
                        />
                      </form>
                    )}
                  </span>
                }
              />
            ))}
          </List>
        </section>
      )}
    </>
  );
}
