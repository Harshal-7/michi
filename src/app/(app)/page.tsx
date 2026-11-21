import type { Metadata } from "next";

import { Stub } from "@/components/ui/stub";
import { requireSignedIn } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  await requireSignedIn();
  return <Stub title="Today" empty="Nothing planned yet. Today's tasks, your streak and this week arrive in round 1." />;
}
