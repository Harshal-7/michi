import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { asc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../client";
import { cards, deckItems, decks, dictionary, items, kanjiInfo, prompts, resources, seedRuns } from "../schema";
import { createTestDb } from "../test/test-db";
import { type Content, ContentError, loadContent } from "./content";
import { seed, seedIfChanged } from "./seed";

const FIXTURES = join(import.meta.dirname, "fixtures");

let db: Db;
let drop: () => Promise<void>;
beforeAll(async () => ({ db, drop } = await createTestDb()));
afterAll(() => drop?.());

/** Empties every table the seed writes, so each test starts from nothing. */
async function reset() {
  await db.execute(
    sql`truncate items, decks, deck_items, cards, resources, prompts, dictionary, kanji_info, seed_runs, settings restart identity cascade`,
  );
}

const fixtures = () => structuredClone(loadContent(FIXTURES).content);

/** Every row the seed can touch, timestamps included. */
async function snapshot() {
  return {
    items: await db.select().from(items).orderBy(asc(items.id)),
    decks: await db.select().from(decks).orderBy(asc(decks.id)),
    deckItems: await db.select().from(deckItems).orderBy(asc(deckItems.deckId), asc(deckItems.itemId)),
    cards: await db.select().from(cards).orderBy(asc(cards.id)),
    resources: await db.select().from(resources).orderBy(asc(resources.id)),
    prompts: await db.select().from(prompts).orderBy(asc(prompts.id)),
    dictionary: await db.select().from(dictionary).orderBy(asc(dictionary.id)),
    kanjiInfo: await db.select().from(kanjiInfo).orderBy(asc(kanjiInfo.kanji)),
  };
}

const itemBySlug = async (slug: string) => (await db.select().from(items).where(eq(items.seedSlug, slug)))[0];

describe("seed", () => {
  beforeEach(reset);

  it("loads the starter content", async () => {
    const summary = await seed(db, fixtures());
    expect(summary.files.kana).toMatchObject({ added: 4 });
    expect(summary.files.words).toMatchObject({ added: 3, linked: 1 });
    expect(summary.files.dictionary).toMatchObject({ added: 3 });
    expect(summary.files["kanji-info"]).toMatchObject({ added: 3 });
    expect(summary.decksAdded).toBe(11);

    const deckRows = await db.select().from(decks).orderBy(asc(decks.position));
    expect(deckRows.map((d) => [d.slug, d.active, d.unlockOn])).toEqual([
      ["hiragana", true, null],
      ["katakana", true, null],
      ["n5-kanji", true, null],
      ["n5-words", true, null],
      ["n5-grammar", true, null],
      ["n4-kanji", false, "2027-01-01"],
      ["n4-words", false, "2027-01-01"],
      ["n4-grammar", false, "2027-01-01"],
      ["n3-kanji", false, "2027-07-05"],
      ["n3-words", false, "2027-07-05"],
      ["n3-grammar", false, "2027-07-05"],
    ]);

    const cardRows = await db.select().from(cards);
    expect(cardRows.every((c) => c.state === "new" && c.dueAt === null && c.fsrs === null)).toBe(true);
    // 4 kana + 3 kanji + 3 words + 1 grammar point with examples; the N4 point has none yet.
    expect(cardRows).toHaveLength(11);
    const youNiNaru = await itemBySlug("grammar:n4:you-ni-naru");
    expect(cardRows.some((c) => c.itemId === youNiNaru.id)).toBe(false);
  });

  it("links a word that's already there instead of adding it twice", async () => {
    await seed(db, fixtures());
    const taberu = await db.select().from(items).where(eq(items.term, "食べる"));
    expect(taberu).toHaveLength(1);
    const inDecks = await db
      .select({ slug: decks.slug })
      .from(deckItems)
      .innerJoin(decks, eq(decks.id, deckItems.deckId))
      .where(eq(deckItems.itemId, taberu[0].id))
      .orderBy(asc(decks.slug));
    expect(inDecks.map((d) => d.slug)).toEqual(["n4-words", "n5-words"]);
    // Still one card: a word in two decks is scheduled once.
    expect(await db.select().from(cards).where(eq(cards.itemId, taberu[0].id))).toHaveLength(1);
  });

  it("changes nothing when run twice", async () => {
    await seed(db, fixtures());
    const before = await snapshot();
    const summary = await seed(db, fixtures());
    expect(await snapshot()).toEqual(before);
    for (const [file, s] of Object.entries(summary.files)) {
      expect({ file, added: s.added, updated: s.updated }).toEqual({ file, added: 0, updated: 0 });
    }
    expect(summary).toMatchObject({ decksAdded: 0, deckItemsAdded: 0, cardsAdded: 0 });
  });

  it("updates changed content but never overwrites your edit", async () => {
    await seed(db, fixtures());
    const edited = await itemBySlug("word:日本:にほん");
    await db
      .update(items)
      .set({ meaning: "Japan (my note)", userEditedAt: new Date() })
      .where(eq(items.id, edited.id));

    const next = fixtures();
    next.words[0].meanings = ["to eat", "to live on"];
    next.words[1].meanings = ["Japan", "Nippon"];
    const summary = await seed(db, next);

    expect(summary.files.words).toMatchObject({ updated: 1, keptEdits: 1 });
    expect((await itemBySlug("word:食べる:たべる")).meaning).toBe("to eat; to live on");
    const kept = await itemBySlug("word:日本:にほん");
    expect(kept.meaning).toBe("Japan (my note)");
    expect(kept.seedHash).toBe(edited.seedHash);
  });

  it("never resets a card", async () => {
    await seed(db, fixtures());
    const item = await itemBySlug("kanji:日");
    const studied = {
      state: "review" as const,
      dueAt: new Date("2026-12-20T00:00:00Z"),
      stability: 12.5,
      difficulty: 4.2,
      reps: 3,
      lapses: 1,
      fsrs: { stability: 12.5 },
      introducedOn: "2026-11-25",
    };
    await db.update(cards).set(studied).where(eq(cards.itemId, item.id));

    const next = fixtures();
    next.kanji[0].meanings = ["day", "sun", "Japan"];
    await seed(db, next);

    const [card] = await db.select().from(cards).where(eq(cards.itemId, item.id));
    expect(card).toMatchObject(studied);
  });

  it("never deletes anything", async () => {
    await seed(db, fixtures());
    const before = await snapshot();
    const next: Content = fixtures();
    next.kana = next.kana.slice(1);
    next.words = [];
    next.dictionary = [];
    next.resources = [];
    await seed(db, next);
    const after = await snapshot();
    expect(after.items).toHaveLength(before.items.length);
    expect(after.cards).toHaveLength(before.cards.length);
    expect(after.deckItems).toHaveLength(before.deckItems.length);
    expect(after.dictionary).toHaveLength(before.dictionary.length);
    expect(after.resources).toHaveLength(before.resources.length);
  });

  it("keeps your deck settings", async () => {
    await seed(db, fixtures());
    await db.update(decks).set({ active: true, unlockOn: null }).where(eq(decks.slug, "n4-words"));
    await seed(db, fixtures());
    const [deck] = await db.select().from(decks).where(eq(decks.slug, "n4-words"));
    expect(deck).toMatchObject({ active: true, unlockOn: null });
  });

  it("updates reference data only where it changed", async () => {
    await seed(db, fixtures());
    const next = fixtures();
    next.dictionary[2].meanings = ["over there"];
    const summary = await seed(db, next);
    expect(summary.files.dictionary).toEqual({ added: 0, updated: 1, unchanged: 2, keptEdits: 0, linked: 0 });
    const [row] = await db.select().from(dictionary).where(eq(dictionary.id, "1000320"));
    expect(row.meanings).toEqual(["over there"]);
  });

  it("adds a grammar point's card once it has examples", async () => {
    await seed(db, fixtures());
    const next = fixtures();
    next.grammar[1].examples = [{ ja: "{泳|およ}げる[[ようになりました]]。", en: "I became able to swim." }];
    const summary = await seed(db, next);
    expect(summary.cardsAdded).toBe(1);
  });
});

describe("seed on deploy", () => {
  beforeEach(reset);

  it("skips when the content hasn't changed", async () => {
    const { content, hash } = loadContent(FIXTURES);
    expect((await seedIfChanged(db, content, hash)).skipped).toBe(false);
    expect((await seedIfChanged(db, content, hash)).skipped).toBe(true);
    expect((await seedIfChanged(db, content, `${hash}x`)).skipped).toBe(false);
    expect(await db.select().from(seedRuns)).toHaveLength(2);
  });
});

describe("loading content", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "michi-content-"));
    for (const name of ["kana", "kanji", "kanji-info", "words", "dictionary", "grammar", "resources", "prompts"]) {
      writeFileSync(join(dir, `${name}.json`), readFileSync(join(FIXTURES, `${name}.json`)));
    }
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("reads the fixtures and hashes them", () => {
    const a = loadContent(dir);
    expect(a.content.words).toHaveLength(4);
    writeFileSync(join(dir, "prompts.json"), "[]");
    expect(loadContent(dir).hash).not.toBe(a.hash);
  });

  it("names the file and the problem", () => {
    writeFileSync(join(dir, "kana.json"), JSON.stringify([{ slug: "kana:x", kana: "x" }]));
    expect(() => loadContent(dir)).toThrow(ContentError);
    expect(() => loadContent(dir)).toThrow(/kana\.json/);
  });

  it("refuses a repeated key", () => {
    const words = JSON.parse(readFileSync(join(FIXTURES, "words.json"), "utf8")) as unknown[];
    writeFileSync(join(dir, "words.json"), JSON.stringify([...words, words[0]]));
    expect(() => loadContent(dir)).toThrow(/repeats the slug/);
  });

  it("refuses a missing file", () => {
    rmSync(join(dir, "grammar.json"));
    expect(() => loadContent(dir)).toThrow(/grammar\.json is missing/);
  });
});
