import type { Metadata } from "next";
import Link from "next/link";

import { ICONS, MORE_NAV } from "@/components/shell/nav";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page";
import { SignOut } from "@/components/ui/sign-out";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { daysBetween, formatLong, formatShort, studyDate } from "@/lib/day";

export const metadata: Metadata = { title: "More" };

/** F_More: the pages that aren't in the phone's bottom bar, and the quick add. */
export default async function MorePage() {
  const session = await requireSignedIn();
  const today = studyDate();
  const { workUnlock } = await getSettings(getDb());
  const notes: Partial<Record<string, string>> = {
    work:
      daysBetween(today, workUnlock) > 0
        ? `unlocks ${formatShort(workUnlock, today)}`
        : undefined,
  };
  return (
    <div className="flex min-h-[calc(100dvh-200px)] flex-col gap-3.5">
      <PageHeader kicker={formatLong(today)} title="More" />
      <nav aria-label="More pages" className="flex flex-col rounded-card bg-surface px-3.5 py-1 shadow-card">
        {MORE_NAV.map((n, i) => (
          <Link
            key={n.key}
            href={n.href}
            className={`flex min-h-[60px] items-center gap-3.5 py-2 no-underline ${i > 0 ? "border-t border-line" : ""}`}
          >
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface2 text-ink">
              <Icon d={n.icon} size={20} />
            </span>
            <span className="flex min-w-0 flex-auto flex-col gap-px">
              <span className="text-[15px] font-semibold">{n.label}</span>
              <span className="text-[12.5px] text-ink2">{notes[n.key] ?? n.note}</span>
            </span>
            <Icon d={ICONS.chevronRight} size={18} stroke={1.8} className="shrink-0 text-ink2" />
          </Link>
        ))}
      </nav>
      <Link
        href="/add-word"
        className="flex min-h-[50px] items-center justify-center gap-2 rounded-btn bg-accent text-[15px] font-bold text-on-accent no-underline"
      >
        <Icon d={ICONS.plus} size={18} stroke={2} />
        Add a word
      </Link>
      <div className="mt-auto">
        <SignOut device={session.device} />
      </div>
    </div>
  );
}
