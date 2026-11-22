import type { Metadata } from "next";

import { SignOut } from "@/components/ui/sign-out";
import { getDb } from "@/db/client";
import { getSettings, listOverrides } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { addDays, studyDate } from "@/lib/day";

import { SettingsEditor } from "./settings-editor";

export const metadata: Metadata = { title: "Settings" };

/** F_Settings. Saving anything rebuilds today's plan; tasks already finished stay finished. */
export default async function SettingsPage() {
  const session = await requireSignedIn();
  const db = getDb();
  const today = studyDate();
  const [settings, exceptions] = await Promise.all([getSettings(db), listOverrides(db, today, addDays(today, 3 * 366))]);
  return (
    <div data-wide className="mx-auto flex w-full max-w-[720px] flex-col gap-3 wide:max-w-none wide:gap-5">
      <h1 className="m-0 font-head text-[28px] leading-[1.2]">Settings</h1>
      <SettingsEditor settings={settings} exceptions={exceptions} today={today} footer={<SignOut device={session.device} />} />
    </div>
  );
}
