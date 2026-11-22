import type { Metadata } from "next";

import { Stub } from "@/components/ui/stub";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { daysBetween, PHASE_NAMES, phaseFor, studyDate } from "@/lib/day";

export const metadata: Metadata = { title: "Progress" };

export default async function ProgressPage() {
  await requireSignedIn();
  const today = studyDate();
  const phase = phaseFor(today, await getSettings(getDb()));
  // F_Progress: "N5 refresh · 29 days left", counting today.
  const kicker = phase
    ? `${PHASE_NAMES[phase.id]}${phase.end ? ` · ${daysBetween(today, phase.end) + 1} days left` : ""}`
    : null;
  return (
    <Stub
      title="Progress"
      size="md"
      kicker={kicker}
      empty="Nothing to chart yet. Progress per level, mock scores and minutes arrive in round 4."
    />
  );
}
