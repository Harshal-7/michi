import type { Metadata } from "next";
import Link from "next/link";

import { QuickCheck } from "@/components/cards/quick-check";
import { UpNextLive } from "@/components/cards/session-done";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { formatLong, studyDate } from "@/lib/day";
import { readDayPlan, ROUTES } from "@/lib/planner/day-plan";
import { loadQuickCheckItems, quickCheckProgress, spotCheckMeanings } from "@/lib/srs/quick-check";
import { upNextAfter } from "@/lib/srs/up-next";

export const metadata: Metadata = { title: "Quick check" };

/** How many more `?more=1` loads past today's target. */
const MORE = 50;

/**
 * The quick check (decision 6): today's share of it, `quickCheckTarget` items from the plan.
 * `?more=1` keeps going past the target.
 */
export default async function QuickCheckPage({ searchParams }: PageProps<"/quick-check">) {
  await requireSignedIn();
  const more = (await searchParams).more === "1";
  const db = getDb();
  const now = new Date();
  const today = studyDate(now);
  const [settings, plan, progress] = await Promise.all([getSettings(db), readDayPlan(db, today), quickCheckProgress(db, today)]);
  const left = progress.total - progress.checked;

  if (left <= 0) {
    return (
      <>
        <PageHeader kicker={formatLong(today)} title="Quick check" />
        <EmptyState>The quick check is finished: all {progress.total} N5 items are checked. What you knew comes back in your reviews.</EmptyState>
      </>
    );
  }
  if (!plan && !more) {
    return (
      <>
        <PageHeader kicker={formatLong(today)} title="Quick check" />
        <EmptyState>
          Today&apos;s plan isn&apos;t made yet, so it doesn&apos;t know how much of the quick check is for today. Open{" "}
          <Link href={ROUTES.today} className="font-bold">
            Today
          </Link>{" "}
          first.
        </EmptyState>
      </>
    );
  }

  const target = more ? MORE : Math.max(0, (plan?.quickCheckTarget ?? 0) - progress.checkedToday);
  const upNext = await upNextAfter(db, { after: "quick_check", plan, date: today, now });
  if (target === 0) {
    return (
      <>
        <PageHeader kicker={`Quick check · day ${Math.min(progress.day, 3)} of 3`} title="Done for today" />
        <EmptyState>
          Today&apos;s share is checked: {progress.checkedToday} items. {left} are left for the next days.{" "}
          <Link href="/quick-check?more=1" className="font-bold">
            Keep going now
          </Link>
        </EmptyState>
        {upNext && <UpNextLive upNext={upNext} />}
      </>
    );
  }

  const [items, pool] = await Promise.all([loadQuickCheckItems(db, target), spotCheckMeanings(db)]);
  return (
    <QuickCheck
      key={now.getTime()}
      items={items}
      day={progress.day}
      leftAfter={left - items.length}
      pool={pool}
      voice={settings.voice}
      furigana={settings.furigana}
      upNext={upNext}
    />
  );
}
