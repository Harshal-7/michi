import type { Metadata } from "next";

import { BackLink } from "@/components/ui/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { SignOut } from "@/components/ui/sign-out";
import { getDb } from "@/db/client";
import { getSettings, listOverrides } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { addDays, studyDate } from "@/lib/day";

import { SettingsEditor } from "./settings-editor";

export const metadata: Metadata = { title: "Settings" };

/** RF_Settings. Saving anything rebuilds today's plan; tasks already finished stay finished. */
export default async function SettingsPage() {
  const session = await requireSignedIn();
  const db = getDb();
  const today = studyDate();
  const [settings, exceptions] = await Promise.all([getSettings(db), listOverrides(db, today, addDays(today, 3 * 366))]);
  return (
    <>
      <header className="flex flex-col gap-1">
        <div className="laptop:hidden">
          <BackLink href="/more">More</BackLink>
        </div>
        <PageHeader title="Settings" />
      </header>
      <SettingsEditor settings={settings} exceptions={exceptions} today={today} footer={<SignOut device={session.device} />} />
    </>
  );
}
