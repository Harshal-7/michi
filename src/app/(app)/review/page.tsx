import type { Metadata } from "next";

import { Stub } from "@/components/ui/stub";
import { requireSignedIn } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Review" };

export default async function ReviewPage() {
  await requireSignedIn();
  return <Stub title="Review" empty="No cards to review yet. Reviews and the quick check arrive in round 1." />;
}
