import type { Metadata } from "next";

import { Leaderboards } from "@/components/play/leaderboards";

export const metadata: Metadata = { title: "Leaderboards" };

/** Every game's boards: the week (from Monday, 4 am IST) and all time, top 20 and your place. */
export default function LeaderboardsPage() {
  return <Leaderboards />;
}
