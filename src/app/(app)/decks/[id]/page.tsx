import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DeckCards, PaceForm } from "@/components/cards/deck-detail";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
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
    <div data-wide className="flex w-full flex-col gap-4 wide:grid wide:grid-cols-[360px_minmax(0,1fr)] wide:items-start wide:gap-x-10">
      {/* Wide: the deck, its review button and its pace stay in view on the left; the cards fill the right. */}
      <div className="flex flex-col gap-4 wide:sticky wide:top-8">
        <PageHeader
          back={{ href: "/decks", label: "Decks" }}
          title={deck.name}
          sub={`${cards.length} cards · ${started} started${suspended ? ` · ${suspended} suspended` : ""}${on ? "" : " · off"}`}
        />
        <Button variant="secondary" icon="review" href={`/review?deck=${id}`} className="self-start">
          Review this deck
        </Button>
        <PaceForm deckId={id} mode={deck.paceMode} perDay={deck.pacePerDay} deadline={deadline ? formatShort(deadline, today) : null} />
      </div>
      {cards.length ? <DeckCards cards={cards} /> : <EmptyState>This deck has no cards yet.</EmptyState>}
    </div>
  );
}
