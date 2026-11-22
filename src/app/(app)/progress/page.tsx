import type { Metadata } from "next";

import { Heatmap, loadHeatmap } from "@/components/progress/heatmap";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { daysBetween, PHASE_NAMES, phaseFor, studyDate } from "@/lib/day";

export const metadata: Metadata = { title: "Progress" };

/** F_Progress. Round 1 draws the year of reviews; the rest of the page is round 4. */
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
      <PageHeader kicker={kicker} title="Progress" size="md" />
      <Heatmap weeks={weeks} today={today} />
      <EmptyState>Progress per level, mock scores and minutes per week arrive in round 4.</EmptyState>
    </>
  );
}
