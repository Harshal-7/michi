import type { Metadata } from "next";

import { SignOut } from "@/components/ui/sign-out";
import { Stub } from "@/components/ui/stub";
import { requireSignedIn } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireSignedIn();
  return (
    <Stub
      title="Settings"
      size="md"
      kicker={null}
      empty="Dates, classes, voice and the reminder become editable in round 1."
    >
      <SignOut device={session.device} />
    </Stub>
  );
}
