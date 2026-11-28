import type { Metadata } from "next";

import { Heatmap, loadHeatmap } from "@/components/progress/heatmap";
import { Rabbit } from "@/components/ui/art/rabbit";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { daysBetween, PHASE_NAMES, phaseFor, studyDate } from "@/lib/day";

export const metadata: Metadata = { title: "Progress" };

/** Progress: the year of reviews now; progress per level, mock scores and minutes per week come later. */
export default async function ProgressPage() {
  await requireSignedIn();
  const today = studyDate();
  const db = getDb();
  const [settings, weeks] = await Promise.all([getSettings(db), loadHeatmap(db, today)]);
  const phase = phaseFor(today, settings);
  // F_Progress: "N5 refresh · 29 days left", counting today.
  const kicker = phase
    ? `${PHASE_NAMES[phase.id]}${phase.end ? ` · ${daysBetween(today, phase.end) + 1} days left` : ""}`
    : null;
  return (
    <>
      <PageHeader sub={kicker} title="Progress" />
      <Heatmap weeks={weeks} today={today} />
      <EmptyState art={<Rabbit pose="reading" size={160} />} title="More is on its way">
        Progress per level, your mock scores and minutes per week will join this page. Until then, Today shows the
        level’s progress and this week.
      </EmptyState>
    </>
  );
}
