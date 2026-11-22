import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DeckCards, PaceForm } from "@/components/cards/deck-detail";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { getDb } from "@/db/client";
import { decks } from "@/db/schema";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { formatShort, studyDate } from "@/lib/day";
import { deckCards, isDeckOn } from "@/lib/srs/decks";

export const metadata: Metadata = { title: "Deck" };

/** One list: its pace, and every card with a way to suspend it. */
export default async function DeckPage({ params }: PageProps<"/decks/[id]">) {
  await requireSignedIn();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const db = getDb();
  const today = studyDate();
  const [[deck], settings] = await Promise.all([db.select().from(decks).where(eq(decks.id, id)), getSettings(db)]);
  if (!deck) notFound();
  const cards = await deckCards(db, id);
  const started = cards.filter((c) => c.state !== "new").length;
  const suspended = cards.filter((c) => c.suspended).length;
  const deadline = deck.deadline ?? (deck.level ? settings.listDeadlines[deck.level] : null);
  const on = isDeckOn(deck, today);

  return (
    <>
      <PageHeader
        kicker={
          <Link href="/decks" className="text-ink2">
            Decks
          </Link>
        }
        title={deck.name}
        sub={`${cards.length} cards · ${started} started${suspended ? ` · ${suspended} suspended` : ""}${on ? "" : " · off"}`}
      />
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/review?deck=${id}`}
          className="inline-flex min-h-11 items-center rounded-btn border border-line bg-surface px-4 text-sm font-semibold no-underline"
        >
          Review this deck
        </Link>
      </div>
      <PaceForm
        deckId={id}
        mode={deck.paceMode}
        perDay={deck.pacePerDay}
        deadline={deadline ? formatShort(deadline, today) : null}
      />
      {cards.length ? <DeckCards cards={cards} /> : <EmptyState>This deck has no cards yet.</EmptyState>}
    </>
  );
}
