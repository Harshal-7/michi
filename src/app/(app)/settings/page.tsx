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

/**
 * RF_Settings. Saving anything rebuilds today's plan; tasks already finished stay finished.
 * Phone and narrow laptop: one column. Wide (1280px+): a sticky section index on the left, the sections
 * in a roomy right column, study and date tiles three across.
 */
export default async function SettingsPage() {
  const session = await requireSignedIn();
  const db = getDb();
  const today = studyDate();
  const [settings, exceptions] = await Promise.all([getSettings(db), listOverrides(db, today, addDays(today, 3 * 366))]);
  return (
    <div data-wide className="mx-auto flex w-full flex-col gap-4 laptop:max-w-158 wide:max-w-none wide:gap-6">
      <header className="flex flex-col gap-1">
        <div className="laptop:hidden">
          <BackLink href="/more">More</BackLink>
        </div>
        <PageHeader title="Settings" />
      </header>
      <SettingsEditor settings={settings} exceptions={exceptions} today={today} footer={<SignOut device={session.device} />} />
    </div>
  );
}
