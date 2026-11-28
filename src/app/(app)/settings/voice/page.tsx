import type { Metadata } from "next";

import { VoiceSettings } from "@/components/cards/voice-settings";
import { Card } from "@/components/ui/card";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { ROUTES } from "@/lib/planner/day-plan";

export const metadata: Metadata = { title: "Japanese voice" };

/** The voice every card plays with: pick it, set its speed, test it, and help installing it. */
export default async function VoicePage() {
  await requireSignedIn();
  const settings = await getSettings(getDb());
  return (
    <>
      <PageHeader title="Japanese voice" back={{ href: ROUTES.settings, label: "Settings" }} />
      <VoiceSettings saved={settings.voice} />
      <Card aria-labelledby="android-voice" className="flex flex-col gap-2">
        <SectionTitle id="android-voice" as="h2">
          No Japanese voice on Android?
        </SectionTitle>
        <ol className="m-0 flex flex-col gap-1.5 pl-5 text-body">
          <li>Open the phone&apos;s Settings, then Text-to-speech output (under Accessibility or System).</li>
          <li>Pick Speech Services by Google as the engine and open its settings.</li>
          <li>Install voice data, then Japanese, and download it.</li>
          <li>Come back here and reload the page.</li>
        </ol>
        <p className="m-0 text-meta text-ink2">
          On a Mac, Chrome has Japanese voices already (Kyoko, and <span lang="ja">Google 日本語</span> online).
        </p>
      </Card>
    </>
  );
}
