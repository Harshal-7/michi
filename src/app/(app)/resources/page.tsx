import type { Metadata } from "next";

import { Spot } from "@/components/ui/art/spots";
import { Stub } from "@/components/ui/stub";
import { requireSignedIn } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Resources" };

/** Resources isn't built yet: a plain note on what's coming. */
export default async function ResourcesPage() {
  await requireSignedIn();
  return (
    <Stub
      title="Resources"
      sub="Study links by skill and level"
      art={<Spot kind="notebook" />}
      emptyTitle="Soon"
      empty="About 45 links, sorted by skill and level, are being put together for this page."
    />
  );
}
