import type { Metadata } from "next";

import { Stub } from "@/components/ui/stub";
import { requireSignedIn } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Decks" };

export default async function DecksPage() {
  await requireSignedIn();
  return (
    <Stub
      title="Decks"
      kicker="New cards come from the lists that are on"
      empty="Switching lists on and off and setting their pace arrive in round 1."
    />
  );
}
