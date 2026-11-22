import type { Metadata } from "next";
import Link from "next/link";

import { VoiceSettings } from "@/components/cards/voice-settings";
import { PageHeader } from "@/components/ui/page";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { ROUTES } from "@/lib/planner/day-plan";

export const metadata: Metadata = { title: "Japanese voice" };

/**
 * The voice every card plays with: pick it, set its speed, test it, and help installing it. On a
 * wide screen the help sits beside the voice list.
 */
export default async function VoicePage() {
  await requireSignedIn();
  const settings = await getSettings(getDb());
  return (
    <div data-wide className="mx-auto flex w-full max-w-[720px] flex-col gap-3 wide:grid wide:max-w-none wide:grid-cols-2 wide:items-start wide:gap-x-5">
      <div className="wide:col-span-2">
      <PageHeader
        kicker={
          <Link href={ROUTES.settings} className="text-ink2">
            Settings
          </Link>
        }
        title="Japanese voice"
        size="md"
      />
      </div>
      <div className="flex flex-col gap-3">
        <VoiceSettings saved={settings.voice} />
      </div>
      <section className="flex flex-col gap-2 rounded-card bg-surface px-3.5 pt-2.5 pb-3.5 shadow-card">
        <h2 className="m-0 text-xs font-bold tracking-[0.04em] text-ink2 uppercase">No Japanese voice on Android?</h2>
        <ol className="m-0 flex flex-col gap-1 pl-5 text-sm">
          <li>Open the phone&apos;s Settings, then Text-to-speech output (under Accessibility or System).</li>
          <li>Pick Speech Services by Google as the engine and open its settings.</li>
          <li>Install voice data, then Japanese, and download it.</li>
          <li>Come back here and reload the page.</li>
        </ol>
        <p className="m-0 text-[12.5px] text-ink2">
          On a Mac, Chrome has Japanese voices already (Kyoko, and <span lang="ja">Google 日本語</span> online).</p>
      </section>
    </div>
  );
}
