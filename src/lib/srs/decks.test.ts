import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/db/client";
import { cards, decks } from "@/db/schema";
import { createTestDb } from "@/db/test/test-db";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";

import { deckCards, isDeckOn, listDecks, setCardSuspended, setDeckOn, setDeckPace } from "./decks";
import { loadReviewQueue } from "./load";
import { addCard, addDeck, resetStudyTables } from "./test-helpers";

let db: Db;
let drop: () => Promise<void>;
beforeAll(async () => ({ db, drop } = await createTestDb()));
afterAll(() => drop?.());
beforeEach(() => resetStudyTables(db));

describe("decks", () => {
  it("is on when switched on or once its unlock date has come", () => {
    expect(isDeckOn({ active: true, unlockOn: null }, "2026-12-01")).toBe(true);
    expect(isDeckOn({ active: false, unlockOn: "2027-01-01" }, "2026-12-31")).toBe(false);
    expect(isDeckOn({ active: false, unlockOn: "2027-01-01" }, "2027-01-01")).toBe(true);
  });

  it("switches off and on, keeping a future unlock date", async () => {
    const id = await addDeck(db);
    await db.update(decks).set({ active: false, unlockOn: "2027-01-01" }).where(eq(decks.id, id));
    await setDeckOn(db, id, true, "2026-12-01");
    expect((await listDecks(db, "2026-12-01"))[0].on).toBe(true);
    await setDeckOn(db, id, false, "2026-12-01");
    let [deck] = await db.select().from(decks).where(eq(decks.id, id));
    expect(deck).toMatchObject({ active: false, unlockOn: "2027-01-01" });
    // After the unlock date, switching off clears it so the deck stays off.
    await setDeckOn(db, id, false, "2027-02-01");
    [deck] = await db.select().from(decks).where(eq(decks.id, id));
    expect(deck).toMatchObject({ active: false, unlockOn: null });
    expect((await listDecks(db, "2027-02-01"))[0].on).toBe(false);
  });

  it("counts items and started items, and sets the pace", async () => {
    const id = await addDeck(db);
    const a = await addCard(db, { deckId: id });
    await addCard(db, { deckId: id });
    await db.update(cards).set({ state: "review" }).where(eq(cards.id, a.cardId));
    await setDeckPace(db, id, { mode: "per_day", perDay: 12 });
    const [summary] = await listDecks(db, "2026-12-01");
    expect(summary).toMatchObject({ items: 2, started: 1, paceMode: "per_day", pacePerDay: 12 });
  });

  it("suspends a card so it stops coming up", async () => {
    const id = await addDeck(db);
    const a = await addCard(db, { deckId: id });
    const now = new Date("2026-12-03T05:00:00.000Z");
    await db.update(cards).set({ state: "review", dueAt: now }).where(eq(cards.id, a.cardId));
    await setCardSuspended(db, a.cardId, true);
    expect((await deckCards(db, id))[0].suspended).toBe(true);
    expect((await loadReviewQueue(db, { settings: DEFAULT_SETTINGS, now })).cards).toHaveLength(0);
    await setCardSuspended(db, a.cardId, false);
    expect((await loadReviewQueue(db, { settings: DEFAULT_SETTINGS, now })).cards).toHaveLength(1);
  });
});
