import { eq } from "drizzle-orm";
import type { Metadata } from "next";

import { ReviewSession } from "@/components/cards/review-session";
import { UpNextLive } from "@/components/cards/session-done";
import { Rabbit } from "@/components/ui/art/rabbit";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/db/client";
import { decks } from "@/db/schema";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { formatLong, studyDate } from "@/lib/day";
import { readDayPlan } from "@/lib/planner/day-plan";
import { deckParam, formatNextDue } from "@/lib/srs/format";
import { loadReviewQueue } from "@/lib/srs/load";
import { dueCounts, upNextAfter } from "@/lib/srs/up-next";

export const metadata: Metadata = { title: "Review" };

/**
 * Learning and due review cards, all decks or `?deck=<id>`, loaded in one request (the plan's
 * "Reviews on a patchy phone connection"). The session itself runs in the browser.
 */
export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  await requireSignedIn();
  const deckId = deckParam((await searchParams).deck);
  const db = getDb();
  const now = new Date();
  const today = studyDate(now);
  const [settings, plan, deck] = await Promise.all([
    getSettings(db),
    readDayPlan(db, today),
    deckId ? db.select({ name: decks.name }).from(decks).where(eq(decks.id, deckId)).then((r) => r[0]) : null,
  ]);
  const { cards } = await loadReviewQueue(db, { settings, deckId, now });
  const upNext = await upNextAfter(db, { after: "review", plan, date: today, now });

  if (cards.length === 0) {
    const { nextDueAt } = await dueCounts(db, now, today);
    return (
      <>
        <PageHeader sub={formatLong(today)} title="Review" />
        <EmptyState
          art={<Rabbit pose="sleepy" size={180} />}
          title={`Nothing to review right now${deck ? ` in ${deck.name}` : ""}`}
          action={!upNext && <Button variant="quiet" href="/">Back to Today</Button>}
        >
          {nextDueAt ? `The next card is due ${formatNextDue(nextDueAt, now)}.` : "Cards come here once you’ve started them."}
        </EmptyState>
        {upNext && <UpNextLive upNext={upNext} />}
      </>
    );
  }

  return (
    <ReviewSession
      // A fresh load (coming back after 5 minutes) starts a fresh session.
      key={now.getTime()}
      mode="review"
      cards={cards}
      fsrs={settings.fsrs}
      voice={settings.voice}
      furigana={settings.furigana}
      label={deck?.name ?? "All due"}
      scope={deck ? `Review · ${deck.name}` : "Review · all decks"}
      upNext={upNext}
    />
  );
}
