import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { ResolveFlag } from "@/components/cards/resolve-flag";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { getDb } from "@/db/client";
import { flags, items } from "@/db/schema";
import { requireSignedIn } from "@/lib/auth/session";
import { formatShort, studyDate } from "@/lib/day";
import { ROUTES } from "@/lib/planner/day-plan";

export const metadata: Metadata = { title: "Flagged items" };

/** Everything flagged as reading wrong, newest first, with Resolve. */
export default async function FlagsPage() {
  await requireSignedIn();
  const rows = await getDb()
    .select({
      id: flags.id,
      note: flags.note,
      status: flags.status,
      target: flags.target,
      createdAt: flags.createdAt,
      term: items.term,
      meaning: items.meaning,
      kind: items.kind,
    })
    .from(flags)
    .leftJoin(items, eq(items.id, flags.itemId))
    .orderBy(desc(flags.createdAt))
    .limit(200);
  const today = studyDate();
  const open = rows.filter((r) => r.status === "open");
  const resolved = rows.filter((r) => r.status === "resolved");

  const list = (group: typeof rows) => (
    <section className="flex flex-col rounded-card bg-surface px-3.5 py-1 shadow-card">
      {group.map((f, i) => {
        const shown = f.target as { term?: string; meaning?: string };
        return (
          <div key={f.id} className={`flex items-start gap-3 py-2.5 ${i ? "border-t border-line" : ""}`}>
            <div className="flex min-w-0 flex-auto flex-col gap-0.5">
              <p className="m-0 flex flex-wrap items-baseline gap-2">
                <span lang="ja" className="font-card text-lg font-semibold">
                  {f.term ?? shown.term ?? "A removed item"}
                </span>
                <span className="text-xs text-ink2">{f.meaning ?? shown.meaning}</span>
              </p>
              {f.note && <p className="m-0 text-sm">{f.note}</p>}
              <p className="m-0 text-xs text-ink2">Flagged {formatShort(studyDate(f.createdAt), today)}</p>
            </div>
            <ResolveFlag id={f.id} resolved={f.status === "resolved"} />
          </div>
        );
      })}
    </section>
  );

  return (
    <>
      <PageHeader
        kicker={
          <Link href={ROUTES.settings} className="text-ink2">
            Settings
          </Link>
        }
        title="Flagged items"
        size="md"
      />
      {open.length ? list(open) : <EmptyState>Nothing flagged. Use the flag on any card when something reads wrong.</EmptyState>}
      {resolved.length > 0 && (
        <>
          <h2 className="m-0 mt-2 text-xs font-bold tracking-[0.04em] text-ink2 uppercase">Resolved</h2>
          {list(resolved)}
        </>
      )}
    </>
  );
}
