import type { Metadata } from "next";
import { Rabbit } from "@/components/ui/art/rabbit";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
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
        <PageHeader back={{ href: "/practice", label: "Practice" }} title="Mistakes review" />
        <EmptyState
          art={<Rabbit pose="sleepy" size={180} />}
          title="No mistakes waiting"
          action={
            <Button variant="quiet" href="/practice/history">
              Quiz history
            </Button>
          }
        >
          Ones from your quizzes come here for a week.
        </EmptyState>
      </>
    );
  }
  return <MistakesReview key={mistakes.map((m) => m.id).join(",")} items={mistakes.map((m) => ({ id: m.id, asked: m.asked }))} furigana={settings.furigana} voice={settings.voice} />;
}
