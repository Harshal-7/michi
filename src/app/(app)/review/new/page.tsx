import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { ReviewSession } from "@/components/cards/review-session";
import { UpNextLive } from "@/components/cards/session-done";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/db/client";
import { decks } from "@/db/schema";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { formatLong, studyDate } from "@/lib/day";
import { readDayPlan, ROUTES } from "@/lib/planner/day-plan";
import { deckParam } from "@/lib/srs/format";
import { loadNewCards } from "@/lib/srs/load";
import { upNextAfter } from "@/lib/srs/up-next";

export const metadata: Metadata = { title: "New items" };

/**
 * Today's new cards: exactly the plan's quota per deck, in queue order. Each shows its back
 * first and is then graded; the first grade marks it introduced.
 */
export default async function NewItemsPage({ searchParams }: PageProps<"/review/new">) {
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

  if (!plan) {
    return (
      <>
        <PageHeader kicker={formatLong(today)} title="New items" />
        <EmptyState>
          Today&apos;s plan isn&apos;t made yet, so there are no new cards to bring in. Open{" "}
          <Link href={ROUTES.today} className="font-bold">
            Today
          </Link>{" "}
          first, then come back.
        </EmptyState>
      </>
    );
  }

  const { cards, decks: quotas } = await loadNewCards(db, { plan, date: today, deckId });
  const upNext = await upNextAfter(db, { after: "new", plan, date: today, now });

  if (cards.length === 0) {
    const introduced = quotas.reduce((sum, d) => sum + Math.min(d.quota, d.introduced), 0);
    return (
      <>
        <PageHeader kicker={formatLong(today)} title="New items" />
        <EmptyState>
          {introduced > 0
            ? `Today's new cards are in: ${introduced} introduced. They come back in your reviews.`
            : "No new cards today. Today's plan has none, or every list that's on is finished."}
        </EmptyState>
        {upNext && <UpNextLive upNext={upNext} />}
      </>
    );
  }

  return (
    <ReviewSession
      key={now.getTime()}
      mode="new"
      cards={cards}
      fsrs={settings.fsrs}
      voice={settings.voice}
      furigana={settings.furigana}
      label={deck?.name ?? "New items"}
      scope={`New items · ${quotas.map((d) => d.name).join(", ")}`}
      upNext={upNext}
    />
  );
}
