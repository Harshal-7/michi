import type { Metadata } from "next";

import { DeckList } from "@/components/cards/deck-list";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { daysBetween, formatShort, type StudyDate, studyDate } from "@/lib/day";
import { type DayPlan, newQuotaFor, readDayPlan } from "@/lib/planner/day-plan";
import { type DeckSummary, listDecks } from "@/lib/srs/decks";

export const metadata: Metadata = { title: "Decks" };

const UNITS: Record<string, [string, string]> = {
  kana: ["card", "cards"],
  kanji: ["kanji", "kanji"],
  word: ["word", "words"],
  grammar: ["point", "points"],
  phrase: ["phrase", "phrases"],
};

/** "80 kanji · about 2 new a day", "668 words · off, switches on Fri 1 Jan" (F_Decks). */
function deckMeta(d: DeckSummary, plan: DayPlan | null, today: StudyDate): string {
  const [one, many] = UNITS[d.kind ?? "word"] ?? ["card", "cards"];
  const size = `${d.items.toLocaleString("en-IN")} ${d.items === 1 ? one : many}${d.kind === "grammar" ? " · fill-in cards" : ""}`;
  let state: string;
  if (!d.on) {
    state = d.unlockOn && daysBetween(today, d.unlockOn) > 0 ? `off, switches on ${formatShort(d.unlockOn, today)}` : "off";
  } else if (d.items > 0 && d.started >= d.items) state = "all started";
  else {
    const quota = newQuotaFor(plan, d.id);
    if (quota > 0) state = `about ${quota} new a day`;
    else if (d.paceMode === "per_day" && d.pacePerDay) state = `${d.pacePerDay} new a day`;
    else state = d.started > 0 ? `${d.started} started` : "not started";
  }
  return d.kind === "grammar" && !d.on ? `${size.split(" · ")[0]} · ${state}` : `${size} · ${state}`;
}

/** Switch lists on and off, and open one to set its pace or browse and suspend its cards. */
export default async function DecksPage() {
  await requireSignedIn();
  const db = getDb();
  const today = studyDate();
  const [decks, plan, settings] = await Promise.all([listDecks(db, today), readDayPlan(db, today), getSettings(db)]);
  const workLocked = daysBetween(today, settings.workUnlock) > 0;
  return (
    <>
      <PageHeader kicker="New cards come from the lists that are on" title="Decks" />
      <DeckList
        rows={decks.map((d) => ({ id: d.id, name: d.name, on: d.on, meta: deckMeta(d, plan, today) }))}
        workLockedUntil={workLocked ? formatShort(settings.workUnlock, today) : null}
      />
      {!decks.some((d) => d.source === "class") && <EmptyState>Class decks appear after your first class log.</EmptyState>}
    </>
  );
}
