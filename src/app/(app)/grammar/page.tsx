import type { Metadata } from "next";

import { Stub } from "@/components/ui/stub";
import { requireSignedIn } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Grammar" };

export default async function GrammarPage() {
  await requireSignedIn();
  return <Stub title="Grammar" empty="No grammar points to show yet. The tracker arrives in round 2." />;
}
