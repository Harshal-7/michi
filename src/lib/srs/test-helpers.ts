/** Rows for the srs database tests. */
import { eq, sql } from "drizzle-orm";

import type { Db } from "@/db/client";
import { cards, deckItems, decks, items } from "@/db/schema";

export async function resetStudyTables(db: Db) {
  await db.execute(
    sql`truncate items, decks, deck_items, cards, review_logs, quick_check, day_plans, settings, flags restart identity cascade`,
  );
}

let counter = 0;

/** An item with one card in state new, in the given deck. */
export async function addCard(
  db: Db,
  options: {
    kind?: "kana" | "kanji" | "word" | "grammar";
    level?: "N5" | "N4" | "N3";
    source?: "starter" | "class";
    deckId?: number;
    newRank?: number;
    cardType?: "recognition" | "fill_in";
  } = {},
): Promise<{ itemId: number; cardId: number }> {
  counter++;
  const kind = options.kind ?? "word";
  const [item] = await db
    .insert(items)
    .values({
      kind,
      level: options.level ?? "N5",
      term: `語${counter}`,
      reading: `ご${counter}`,
      meaning: `word ${counter}`,
      source: options.source ?? "starter",
      dedupeKey: `test-${counter}`,
    })
    .returning({ id: items.id });
  const [card] = await db
    .insert(cards)
    .values({ itemId: item.id, cardType: options.cardType ?? "recognition", newRank: options.newRank ?? counter })
    .returning({ id: cards.id });
  if (options.deckId) await db.insert(deckItems).values({ deckId: options.deckId, itemId: item.id, position: counter });
  return { itemId: item.id, cardId: card.id };
}

export async function addDeck(db: Db, name = "N5 words", position = 0): Promise<number> {
  const [deck] = await db.insert(decks).values({ name, source: "starter", active: true, position }).returning({ id: decks.id });
  return deck.id;
}

export async function cardRow(db: Db, id: number) {
  const [row] = await db.select().from(cards).where(eq(cards.id, id));
  return row;
}
