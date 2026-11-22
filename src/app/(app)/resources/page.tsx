import type { Metadata } from "next";

import { Stub } from "@/components/ui/stub";
import { requireSignedIn } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Resources" };

export default async function ResourcesPage() {
  await requireSignedIn();
  return (
    <Stub
      title="Resources"
      kicker="About 45 links by skill and level"
      empty="No links to show yet. The resources page arrives in round 3."
    />
  );
}
