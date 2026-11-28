import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";

import { ResolveFlag } from "@/components/cards/resolve-flag";
import { Spot } from "@/components/ui/art/spots";
import { EmptyState } from "@/components/ui/empty-state";
import { List } from "@/components/ui/list-row";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
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
    <List>
      {group.map((f) => {
        const shown = f.target as { term?: string; meaning?: string };
        return (
          <li key={f.id} className="flex items-start gap-3 border-b-[1.5px] border-line py-3 last:border-b-0">
            <div className="flex min-w-0 flex-auto flex-col gap-0.5">
              <p className="m-0 flex flex-wrap items-baseline gap-x-2">
                <span lang="ja" className="font-ja text-title font-semibold">
                  {f.term ?? shown.term ?? "A removed item"}
                </span>
                <span className="text-meta text-ink2">{f.meaning ?? shown.meaning}</span>
              </p>
              {f.note && <p className="m-0 text-body">{f.note}</p>}
              <p className="m-0 text-meta text-ink2">Flagged {formatShort(studyDate(f.createdAt), today)}</p>
            </div>
            <ResolveFlag id={f.id} resolved={f.status === "resolved"} />
          </li>
        );
      })}
    </List>
  );

  return (
    <>
      <PageHeader title="Flagged items" back={{ href: ROUTES.settings, label: "Settings" }} />
      {open.length ? (
        list(open)
      ) : (
        <EmptyState art={<Spot kind="notebook" />} title="Nothing flagged">
          Use the flag on any card when something reads wrong.
        </EmptyState>
      )}
      {resolved.length > 0 && (
        <section aria-labelledby="resolved" className="flex flex-col">
          <SectionTitle id="resolved" meta={`${resolved.length}`}>
            Resolved
          </SectionTitle>
          {list(resolved)}
        </section>
      )}
    </>
  );
}
