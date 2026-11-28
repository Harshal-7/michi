import type { Metadata } from "next";

import { ListenDrill } from "@/components/quiz/mistakes-review";
import { Spot } from "@/components/ui/art/spots";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { studyDate } from "@/lib/day";
import { compose } from "@/lib/quiz/compose";
import { levelsFor, loadBank, loadPool } from "@/lib/quiz/store";

export const metadata: Metadata = { title: "Listen and choose" };

/**
 * Five words read aloud by the device's Japanese voice; pick how each is written. Nothing is
 * saved but the minutes. Built from RF_QuizQuestion's parts.
 */
export default async function ListenPage() {
  await requireSignedIn();
  const db = getDb();
  const today = studyDate();
  const settings = await getSettings(db);
  const { bank, byId } = await loadBank(db, levelsFor(today, settings));
  const pool = await loadPool(db, { date: today, byId });
  const built = compose({ kind: "listen", pool, bank, kanaPhase: false, hasVoice: true, random: Math.random });
  if (built.length === 0) {
    return (
      <>
        <PageHeader back={{ href: "/practice", label: "Practice" }} title="Listen and choose" />
        <EmptyState art={<Spot kind="notebook" />} title="Nothing to listen to yet">
          Words you&apos;ve started come here.
        </EmptyState>
      </>
    );
  }
  return <ListenDrill key={built.map((b) => b.itemId).join(",")} items={built.map((b) => b.asked)} furigana={settings.furigana} voice={settings.voice} />;
}
