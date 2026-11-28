import type { Metadata } from "next";
import Link from "next/link";

import { MORE_NAV } from "@/components/shell/nav";
import { Rabbit } from "@/components/ui/art/rabbit";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { List, ListRow } from "@/components/ui/list-row";
import { PageHeader } from "@/components/ui/page-header";
import { SignOut } from "@/components/ui/sign-out";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { daysBetween, formatDayMonth, formatLong, studyDate } from "@/lib/day";

export const metadata: Metadata = { title: "More" };

/** RF_More: the pages that aren't in the phone's bottom bar, the way into the games, and signing out. */
export default async function MorePage() {
  const session = await requireSignedIn();
  const today = studyDate();
  const { workUnlock } = await getSettings(getDb());
  const workLocked = daysBetween(today, workUnlock) > 0;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="More" sub={formatLong(today)} />
      <nav aria-label="More pages">
        <List>
          {MORE_NAV.map((n) => {
            const locked = n.key === "work" && workLocked;
            const waiting = n.soon || locked;
            return (
              <ListRow
                key={n.key}
                href={waiting ? undefined : n.href}
                lead={{ icon: n.icon, cover: n.cover, waiting }}
                title={n.label}
                meta={locked ? `${n.note} · opens ${formatDayMonth(workUnlock)}` : n.note}
                trailing={n.soon ? <Chip kind="soon">Soon</Chip> : undefined}
                disabled={waiting}
              />
            );
          })}
        </List>
      </nav>
      <Link
        href="/play"
        className="mt-1 flex min-h-20 items-center gap-4 rounded-card bg-cover-cobalt p-2 pr-5 text-on-cobalt no-underline shadow-card transition-transform duration-120 active:translate-y-px"
      >
        <span className="grid size-17 shrink-0 place-items-center overflow-hidden rounded-btn-lg bg-cover-blue">
          <Rabbit pose="cheering" size={64} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-title font-black">Games</span>
          <span className="text-meta">The kana game and leaderboards, open to friends</span>
        </span>
        <Icon name="arrow-right" size={24} />
      </Link>
      <div className="mt-2">
        <SignOut device={session.device} />
      </div>
    </div>
  );
}
