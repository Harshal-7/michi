import type { Metadata } from "next";

import { Rabbit } from "@/components/ui/art/rabbit";
import { BackLink } from "@/components/ui/back-link";
import { Stub } from "@/components/ui/stub";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { daysBetween, formatShort, studyDate } from "@/lib/day";

export const metadata: Metadata = { title: "Work Japanese" };

const MODULES = "keigo, a self-introduction, interviews, email and chat, and IT terms";

/** Work Japanese: locked until it opens with the N4 phase, and not built yet either way. */
export default async function WorkPage() {
  await requireSignedIn();
  const today = studyDate();
  const { workUnlock } = await getSettings(getDb());
  const locked = daysBetween(today, workUnlock) > 0;
  return (
    <>
      <div className="laptop:hidden">
        <BackLink href="/more">More</BackLink>
      </div>
      <Stub
        title="Work Japanese"
        sub="Japanese for a developer job in Japan."
        art={<Rabbit pose={locked ? "sleepy" : "reading"} size={180} />}
        emptyTitle={locked ? `Opens ${formatShort(workUnlock, today)}` : "Soon"}
        empty={
          locked
            ? `It opens with the N4 phase. Then come five parts: ${MODULES}.`
            : `Five parts are being written: ${MODULES}.`
        }
      />
    </>
  );
}
