import type { Metadata } from "next";
import Link from "next/link";

import { ICONS } from "@/components/shell/nav";
import { Icon } from "@/components/ui/icon";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { daysBetween, formatShort, studyDate } from "@/lib/day";

export const metadata: Metadata = { title: "Work Japanese" };

/** F_Work: the back link, the header and, until it unlocks, the lock card. */
export default async function WorkPage() {
  await requireSignedIn();
  const today = studyDate();
  const { workUnlock } = await getSettings(getDb());
  const locked = daysBetween(today, workUnlock) > 0;
  return (
    <>
      <Link
        href="/more"
        className="-mt-1 inline-flex min-h-11 items-center gap-1 self-start text-[13px] text-ink2 no-underline laptop:hidden"
      >
        <Icon d={ICONS.chevronLeft} size={16} stroke={2} />
        More
      </Link>
      <PageHeader
        title="Work Japanese"
        size="md"
        sub="Japanese for a developer job in Japan: interviews, the office and chat."
      />
      {locked && (
        <section className="flex items-center gap-3 rounded-card bg-accent-soft p-3.5">
          <Icon d={ICONS.lock} size={26} className="shrink-0 text-accent" />
          <div className="flex flex-auto flex-col gap-0.5">
            <h2 className="m-0 text-[14.5px] font-bold">Unlocks {formatShort(workUnlock, today)}</h2>
            <p className="m-0 text-[12.5px] text-ink">It opens with the N4 phase. You can look around now.</p>
          </div>
        </section>
      )}
      <EmptyState>The five modules (keigo, self-introduction, interviews, email and chat, IT terms) arrive in round 4.</EmptyState>
    </>
  );
}
