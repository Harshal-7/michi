import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { Stub } from "@/components/ui/stub";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { formatShort, studyDate } from "@/lib/day";

export const metadata: Metadata = { title: "Log" };

export default async function LogPage() {
  await requireSignedIn();
  const { classes } = await getSettings(getDb());
  const first = formatShort(classes.startsOn, studyDate());
  return (
    <Stub title="Log" empty={`No classes logged yet. Your first class is ${first}. The class log arrives in round 3.`}>
      {/* F_Log's "Add minutes" tile; the class log and immersion join it in round 3. */}
      <Link
        href="/log/minutes"
        className="flex min-h-16 items-center gap-3 rounded-card bg-surface px-4 py-2 text-ink no-underline shadow-card"
      >
        <Icon d="M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z M12 8v4l3 2" size={20} stroke={1.7} />
        <span className="flex flex-col gap-px">
          <span className="text-[14.5px] font-bold">Add minutes</span>
          <span className="text-[12.5px] text-ink2">listening, speaking, reading and the rest</span>
        </span>
      </Link>
    </Stub>
  );
}
