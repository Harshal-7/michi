import type { Metadata } from "next";

import { BackLink } from "@/components/learn/tabs";
import { SpeakingPrompt } from "@/components/practice/speaking";
import { EmptyState } from "@/components/ui/page";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { studyDate } from "@/lib/day";
import { ROUTES } from "@/lib/planner/day-plan";
import { promptOfTheDay } from "@/lib/speaking/practice";

export const metadata: Metadata = { title: "Speaking prompt" };

/** The speaking prompt of the day (F_Speaking). */
export default async function SpeakingPage() {
  await requireSignedIn();
  const db = getDb();
  const settings = await getSettings(db);
  const prompt = await promptOfTheDay(db, studyDate(), settings);

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-col gap-0.5">
        <BackLink href={ROUTES.practice}>Practice</BackLink>
        <h1 className="m-0 font-head text-[26px] leading-[1.2]">Speaking prompt</h1>
      </header>
      {prompt ? (
        <SpeakingPrompt prompt={prompt} recognition={settings.speechRecognition} furigana={settings.furigana} voice={settings.voice} />
      ) : (
        <EmptyState>No speaking prompts yet. They arrive with the next content update.</EmptyState>
      )}
    </div>
  );
}
