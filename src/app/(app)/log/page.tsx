import type { Metadata } from "next";

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
    <Stub
      title="Log"
      empty={`No classes logged yet. Your first class is ${first}. The class log arrives in round 3.`}
    />
  );
}
