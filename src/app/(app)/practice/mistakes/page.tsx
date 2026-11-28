// design-lint: legacy
import type { Metadata } from "next";
import Link from "next/link";

import { BackLink } from "@/components/ui/back-link";
import { MistakesReview } from "@/components/quiz/mistakes-review";
import { EmptyState } from "@/components/ui/empty-state";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { studyDate } from "@/lib/day";
import { loadMistakes } from "@/lib/quiz/store";

export const metadata: Metadata = { title: "Mistakes review" };

/**
 * Quiz mistakes from the last 7 days asked again, one per item. A right answer clears one; they
 * already went back into reviews when they were missed, so this changes no schedule.
 */
export default async function MistakesPage() {
  await requireSignedIn();
  const db = getDb();
  const [settings, mistakes] = await Promise.all([getSettings(db), loadMistakes(db, studyDate())]);
  if (mistakes.length === 0) {
    return (
      <>
        <header className="flex flex-col gap-0.5">
          <BackLink href="/practice">Practice</BackLink>
          <h1 className="m-0 font-head text-[28px] leading-[1.15]">Mistakes review</h1>
        </header>
        <EmptyState>No mistakes waiting. Ones from your quizzes come here for a week.</EmptyState>
        <Link href="/practice/history" className="self-start text-[13px] font-semibold text-ink2">
          Quiz history
        </Link>
      </>
    );
  }
  return <MistakesReview key={mistakes.map((m) => m.id).join(",")} items={mistakes.map((m) => ({ id: m.id, asked: m.asked }))} furigana={settings.furigana} voice={settings.voice} />;
}
