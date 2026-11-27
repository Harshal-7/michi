import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db/client";
import { cards, deckItems, decks, dictionary, items, reviewLogs, vocabProgress } from "@/db/schema";
import { createTestDb } from "@/db/test/test-db";

const state = vi.hoisted(() => ({ db: null as unknown as Db, signedIn: true }));
vi.mock(import("@/db/client"), async (importOriginal) => ({ ...(await importOriginal()), getDb: () => state.db }));
vi.mock("@/lib/auth/session", () => ({
  currentSession: async () => (state.signedIn ? { device: "phone" } : null),
  unauthorized: () => Response.json({ error: "Sign in first." }, { status: 401 }),
}));

const { levelCounts, loadVocab, saveVocabResults } = await import("./words");
const { POST } = await import("@/app/api/vocab/route");

let drop: () => Promise<void>;
beforeAll(async () => ({ db: state.db, drop } = await createTestDb()));
afterAll(() => drop?.());

type Word = { term: string; reading: string; meanings: string[]; level?: "N5" | "N4" | "N3"; jmdictId?: string };

/** Word items as the seed makes them, in a starter deck in the given order. */
async function addWords(words: Word[], deckSlug = "n5-words"): Promise<number[]> {
  const [deck] = await state.db
    .insert(decks)
    .values({ slug: deckSlug, name: deckSlug, source: "starter", kind: "word" })
    .onConflictDoNothing()
    .returning({ id: decks.id });
  const rows = await state.db
    .insert(items)
    .values(
      words.map((w) => ({
        kind: "word" as const,
        level: w.level ?? "N5",
        term: w.term,
        reading: w.reading,
        meaning: w.meanings.join("; "),
        source: "starter" as const,
        dedupeKey: `${w.term}:${w.reading}`,
        data: { meanings: w.meanings, pos: ["noun" as const], usuallyKana: false, ...(w.jmdictId ? { jmdictId: w.jmdictId } : {}) },
      })),
    )
    .returning({ id: items.id });
  if (deck) {
    // Deck order is the reverse of insert order, to show list order follows the deck.
    await state.db.insert(deckItems).values(rows.map((r, i) => ({ deckId: deck.id, itemId: r.id, position: rows.length - i })));
  }
  return rows.map((r) => r.id);
}

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 28, 3, minutes)).toISOString();

beforeEach(async () => {
  state.signedIn = true;
  await state.db.execute(sql`truncate items, decks, deck_items, cards, review_logs, vocab_progress, dictionary restart identity cascade`);
});

describe("loading a level's words", () => {
  it("lists them in deck order with other forms, same-meaning words and progress", async () => {
    const [au, ookii, ookina] = await addWords([
      { term: "会う", reading: "あう", meanings: ["to meet", "to see"], jmdictId: "1198180" },
      { term: "大きい", reading: "おおきい", meanings: ["big", "large"] },
      { term: "大きな", reading: "おおきな", meanings: ["big", "large", "great"], level: "N4" },
    ]);
    await state.db.insert(dictionary).values({ id: "1198180", kanji: ["会う", "逢う"], kana: ["あう"], meanings: ["to meet"], pos: [] });
    await saveVocabResults(state.db, [{ itemId: au, direction: "ja_en", kind: "answer", right: true, at: at(0) }]);

    const words = await loadVocab(state.db, "N5");
    expect(words.map((w) => w.term)).toEqual(["大きい", "会う"]);
    const meet = words.find((w) => w.id === au)!;
    expect(meet).toMatchObject({ reading: "あう", meanings: ["to meet", "to see"], forms: ["逢う"], others: [] });
    expect(meet.progress).toEqual({ ja_en: { right: 1, wrong: 0, lastRight: true }, en_ja: null });
    const big = words.find((w) => w.id === ookii)!;
    expect(big.others).toEqual([{ term: "大きな", reading: "おおきな", meaning: "big; large" }]);
    expect(ookina).toBeGreaterThan(0);
  });
});

describe("saving answers", () => {
  it("counts right and wrong per direction, and a fix turns a wrong into a right", async () => {
    const [id] = await addWords([{ term: "紙", reading: "かみ", meanings: ["paper"] }]);
    await saveVocabResults(state.db, [
      { itemId: id, direction: "ja_en", kind: "answer", right: false, at: at(1) },
      { itemId: id, direction: "ja_en", kind: "answer", right: true, at: at(2) },
      { itemId: id, direction: "en_ja", kind: "answer", right: false, at: at(3) },
    ]);
    let [w] = await loadVocab(state.db, "N5");
    expect(w.progress).toEqual({ ja_en: { right: 1, wrong: 1, lastRight: true }, en_ja: { right: 0, wrong: 1, lastRight: false } });

    await saveVocabResults(state.db, [{ itemId: id, direction: "en_ja", kind: "fix", right: true, at: at(3) }]);
    [w] = await loadVocab(state.db, "N5");
    expect(w.progress.en_ja).toEqual({ right: 1, wrong: 0, lastRight: true });
  });

  it("keeps the latest answer as the last result when an older one saves late", async () => {
    const [id] = await addWords([{ term: "紙", reading: "かみ", meanings: ["paper"] }]);
    await saveVocabResults(state.db, [{ itemId: id, direction: "ja_en", kind: "answer", right: true, at: at(10) }]);
    await saveVocabResults(state.db, [{ itemId: id, direction: "ja_en", kind: "answer", right: false, at: at(5) }]);
    const [w] = await loadVocab(state.db, "N5");
    expect(w.progress.ja_en).toEqual({ right: 1, wrong: 1, lastRight: true });
  });

  it("drops answers for words that are gone and never touches cards or reviews", async () => {
    const [id] = await addWords([{ term: "紙", reading: "かみ", meanings: ["paper"] }]);
    const [card] = await state.db.insert(cards).values({ itemId: id, cardType: "recognition" }).returning();
    const saved = await saveVocabResults(state.db, [
      { itemId: id, direction: "ja_en", kind: "answer", right: true, at: at(1) },
      { itemId: 99_999, direction: "ja_en", kind: "answer", right: true, at: at(1) },
    ]);
    expect(saved).toBe(1);
    const [after] = await state.db.select().from(cards);
    expect(after).toEqual(card);
    expect(await state.db.select().from(reviewLogs)).toEqual([]);
  });

  it("counts each level's words typed right at least once, each way", async () => {
    const ids = await addWords([
      { term: "紙", reading: "かみ", meanings: ["paper"] },
      { term: "水", reading: "みず", meanings: ["water"] },
      { term: "届く", reading: "とどく", meanings: ["to reach"], level: "N4" },
    ]);
    await saveVocabResults(state.db, [
      { itemId: ids[0], direction: "ja_en", kind: "answer", right: true, at: at(1) },
      { itemId: ids[1], direction: "ja_en", kind: "answer", right: false, at: at(1) },
      { itemId: ids[2], direction: "en_ja", kind: "answer", right: true, at: at(1) },
    ]);
    expect(await levelCounts(state.db)).toEqual({
      N5: { total: 2, ja_en: 1, en_ja: 0 },
      N4: { total: 1, ja_en: 0, en_ja: 1 },
      N3: { total: 0, ja_en: 0, en_ja: 0 },
    });
  });
});

describe("POST /api/vocab", () => {
  const post = (body: unknown) => POST(new Request("http://localhost/api/vocab", { method: "POST", body: JSON.stringify(body) }));

  it("checks the session and the body", async () => {
    state.signedIn = false;
    expect((await post({ results: [] })).status).toBe(401);
    state.signedIn = true;
    expect((await post({ results: [] })).status).toBe(400);
    expect((await post({ results: [{ itemId: 1, direction: "sideways", kind: "answer", right: true, at: at(1) }] })).status).toBe(400);
  });

  it("saves a batch", async () => {
    const [id] = await addWords([{ term: "紙", reading: "かみ", meanings: ["paper"] }]);
    const response = await post({ results: [{ itemId: id, direction: "ja_en", kind: "answer", right: true, at: at(1) }] });
    expect(await response.json()).toEqual({ saved: 1 });
    expect(await state.db.select({ right: vocabProgress.right }).from(vocabProgress)).toEqual([{ right: 1 }]);
  });
});
