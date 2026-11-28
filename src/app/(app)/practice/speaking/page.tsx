import type { Metadata } from "next";

import { SpeakingPrompt } from "@/components/practice/speaking";
import { Spot } from "@/components/ui/art/spots";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { studyDate } from "@/lib/day";
import { ROUTES } from "@/lib/planner/day-plan";
import { promptOfTheDay } from "@/lib/speaking/practice";

export const metadata: Metadata = { title: "Speaking prompt" };

/** The speaking prompt of the day. */
export default async function SpeakingPage() {
  await requireSignedIn();
  const db = getDb();
  const settings = await getSettings(db);
  const prompt = await promptOfTheDay(db, studyDate(), settings);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Speaking prompt" back={{ href: ROUTES.practice, label: "Practice" }} />
      {prompt ? (
        <SpeakingPrompt prompt={prompt} recognition={settings.speechRecognition} furigana={settings.furigana} voice={settings.voice} />
      ) : (
        <EmptyState art={<Spot kind="notebook" />} title="No speaking prompts yet">
          They arrive with the next content update.
        </EmptyState>
      )}
    </div>
  );
}
