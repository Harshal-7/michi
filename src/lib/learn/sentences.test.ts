import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/db/client";
import { grammarProgress, items, userSentences } from "@/db/schema";
import { createTestDb } from "@/db/test/test-db";

import {
  addSentence,
  checkedSentencesFor,
  defaultPart,
  deleteSentence,
  editSentence,
  loadMine,
  markPart,
  setChecked,
  setNotes,
  splitPart,
} from "./sentences";

let db: Db;
let drop: () => Promise<void>;
beforeAll(async () => ({ db, drop } = await createTestDb()));
afterAll(() => drop?.());
beforeEach(() => db.execute(sql`truncate items, grammar_progress, user_sentences restart identity cascade`));

async function addPoint(term = "〜てください", kind: "grammar" | "word" = "grammar") {
  const [row] = await db
    .insert(items)
    .values({ kind, level: "N5", term, meaning: "please do", source: "starter", dedupeKey: `${term}-${Math.random()}` })
    .returning({ id: items.id });
  return row.id;
}

const idsOf = async (itemId: number) => (await loadMine(db, itemId)).sentences.map((s) => s.id);

describe("defaultPart", () => {
  it("takes the pattern without 〜, brackets or placeholders", () => {
    expect(defaultPart("〜てください")).toBe("てください");
    expect(defaultPart("〜てもいいです")).toBe("てもいいです");
    expect(defaultPart("〜ちゃいけない / 〜じゃいけない")).toBe("ちゃいけない");
    expect(defaultPart("〜なくてもいい(です)")).toBe("なくてもいい");
    expect(defaultPart("AはBより〜")).toBe("より");
    expect(defaultPart("〜{前|まえ}に")).toBe("前に");
    expect(defaultPart("い-adjectives")).toBe("い");
  });
});

describe("markPart", () => {
  it("marks the grammar part once as the blank", () => {
    expect(markPart(" ゆっくり話してください。 ", "てください")).toEqual({ ja: "ゆっくり話し[[てください]]。" });
  });

  it("says calmly when it can't", () => {
    expect(markPart("まどをあけて。", "てください")).toEqual({ error: expect.stringContaining("isn't in the sentence") });
    expect(markPart("のをのを", "の")).toEqual({ error: expect.stringContaining("more than once") });
    expect(markPart("", "て")).toEqual({ error: "Write a sentence first." });
    expect(markPart("まど", " ")).toEqual({ error: expect.stringContaining("which part") });
    expect(markPart("まど[[を]]", "を")).toEqual({ error: expect.stringContaining("Plain text") });
  });

  it("splits a stored sentence back into what was typed", () => {
    expect(splitPart("ゆっくり{話|はな}し[[てください]]。")).toEqual({ sentence: "ゆっくり話してください。", part: "てください" });
  });
});

describe("sentences", () => {
  it("adds, edits, checks and deletes, oldest first", async () => {
    const point = await addPoint();
    expect(await addSentence(db, point, { sentence: "ゆっくり話してください。", part: "てください", en: " Please speak slowly. " })).toEqual({ ok: true });
    expect(await addSentence(db, point, { sentence: "まどをあけてください。", part: "てください", en: "" })).toEqual({ ok: true });
    expect(await addSentence(db, point, { sentence: "まどをあけて。", part: "てください", en: "" })).toMatchObject({ error: expect.any(String) });

    let mine = await loadMine(db, point);
    expect(mine.sentences).toEqual([
      { id: expect.any(Number), ja: "ゆっくり話し[[てください]]。", en: "Please speak slowly.", checked: false },
      { id: expect.any(Number), ja: "まどをあけ[[てください]]。", en: "", checked: false },
    ]);
    const [first, second] = mine.sentences.map((s) => s.id);

    await setChecked(db, first, true);
    await setChecked(db, second, true);
    await setChecked(db, second, false);
    mine = await loadMine(db, point);
    expect(mine.sentences.map((s) => s.checked)).toEqual([true, false]);

    await deleteSentence(db, second);
    expect(await idsOf(point)).toEqual([first]);
  });

  it("keeps a checked sentence checked when only its English changes, and unchecks it when its Japanese does", async () => {
    const point = await addPoint();
    await addSentence(db, point, { sentence: "ゆっくり話してください。", part: "てください", en: "" });
    const [id] = await idsOf(point);
    await setChecked(db, id, true);

    await editSentence(db, id, { sentence: "ゆっくり話してください。", part: "てください", en: "Please speak slowly." });
    expect((await loadMine(db, point)).sentences[0]).toMatchObject({ checked: true, en: "Please speak slowly." });

    await editSentence(db, id, { sentence: "もっとゆっくり話してください。", part: "てください", en: "Please speak more slowly." });
    expect((await loadMine(db, point)).sentences[0]).toMatchObject({ ja: "もっとゆっくり話し[[てください]]。", checked: false });

    expect(await editSentence(db, 999, { sentence: "あ", part: "あ", en: "" })).toMatchObject({ error: expect.any(String) });
  });

  it("only takes sentences for grammar points", async () => {
    const word = await addPoint("食べる", "word");
    expect(await addSentence(db, word, { sentence: "食べる", part: "る", en: "" })).toMatchObject({ error: expect.any(String) });
    expect(await addSentence(db, 999, { sentence: "食べる", part: "る", en: "" })).toMatchObject({ error: expect.any(String) });
  });

  it("gives each item's checked sentences, never the unchecked ones", async () => {
    const a = await addPoint("〜てください");
    const b = await addPoint("〜てもいい");
    const c = await addPoint("〜たい");
    await db.insert(userSentences).values([
      { itemId: a, ja: "[[てください]]1", en: "one", checked: true },
      { itemId: a, ja: "[[てください]]2", en: "two", checked: false },
      { itemId: a, ja: "[[てください]]3", en: "three", checked: true },
      { itemId: b, ja: "[[てもいい]]", en: "", checked: false },
      { itemId: c, ja: "[[たい]]", en: "", checked: true },
    ]);
    const map = await checkedSentencesFor(db, [a, b, a]);
    expect([...map.keys()]).toEqual([a]);
    expect(map.get(a)).toEqual([
      { ja: "[[てください]]1", en: "one" },
      { ja: "[[てください]]3", en: "three" },
    ]);
    expect((await checkedSentencesFor(db, [])).size).toBe(0);
  });
});

describe("notes", () => {
  it("saves notes and keeps the status", async () => {
    const point = await addPoint();
    expect((await loadMine(db, point)).notes).toBe("");
    await setNotes(db, point, "Teacher: add ちょっと to soften it.");
    expect((await loadMine(db, point)).notes).toBe("Teacher: add ちょっと to soften it.");

    await db.update(grammarProgress).set({ status: "learning" }).where(eq(grammarProgress.itemId, point));
    await setNotes(db, point, "");
    const [row] = await db.select().from(grammarProgress).where(eq(grammarProgress.itemId, point));
    expect(row).toMatchObject({ status: "learning", notes: "" });
    expect(await setNotes(db, 999, "x")).toMatchObject({ error: expect.any(String) });
  });
});
