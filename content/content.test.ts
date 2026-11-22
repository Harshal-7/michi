/**
 * Checks on the generated starter content: the counts, keys, required fields, examples, grammar
 * drills, furigana and links. `pnpm content:build` runs the same checks before it writes anything.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { EXPECTED } from "../scripts/content/lib/expected";
import { dedupeKey } from "../src/lib/items/dedupe";
import {
  blanks,
  CONTENT_FILES,
  CONTENT_KEYS,
  type ContentFile,
  type Grammar,
  type Kana,
  type Kanji,
  type KanjiInfo,
  LEVELS,
  parseRuby,
  type Prompt,
  type Resource,
  toPlain,
  type Word,
} from "./schema";

const read = <T>(path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as T;
const load = <T>(name: ContentFile) => CONTENT_FILES[name].parse(read(`./generated/${name}.json`)) as T[];

const kana = load<Kana>("kana");
const kanji = load<Kanji>("kanji");
const kanjiInfo = load<KanjiInfo>("kanji-info");
const words = load<Word>("words");
const dictionary = load<{ id: string }>("dictionary");
const grammar = load<Grammar>("grammar");
const resources = load<Resource>("resources");
const prompts = load<Prompt>("prompts");

const count = <T>(items: T[], key: (t: T) => string) =>
  items.reduce<Record<string, number>>((acc, i) => ({ ...acc, [key(i)]: (acc[key(i)] ?? 0) + 1 }), {});

/** Every piece of Japanese that may carry ruby, with where it came from. */
function japanese(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  for (const w of words) if (w.example) out.push({ where: `${w.slug} example`, text: w.example.ja });
  for (const g of grammar) {
    g.examples.forEach((e, i) => out.push({ where: `${g.slug} example ${i + 1}`, text: e.ja }));
    for (const q of g.questions) {
      out.push({ where: q.slug, text: q.ja });
      for (const w of q.wrong) out.push({ where: `${q.slug} wrong option`, text: w });
    }
  }
  for (const p of prompts) {
    out.push({ where: `${p.slug} model`, text: p.model });
    for (const h of p.hints) out.push({ where: `${p.slug} hint`, text: h });
  }
  return out;
}

describe("counts", () => {
  it("has 104 hiragana and 124 katakana", () => {
    expect(count(kana, (k) => k.script)).toEqual(EXPECTED.kana);
    expect(count(kana.filter((k) => k.script === "hiragana"), (k) => k.group)).toEqual({ basic: 46, dakuten: 25, combo: 33 });
  });

  it("has 80 / 166 / 367 kanji and all 2,136 jōyō kanji", () => {
    expect(count(kanji, (k) => k.level)).toEqual(EXPECTED.kanji);
    expect(kanji.find((k) => k.kanji === "分")?.level).toBe("N5");
    expect(kanjiInfo).toHaveLength(EXPECTED.kanjiInfo);
  });

  it("has the N5 / N4 / N3 words, the JMdict common words, the grammar and the prompts", () => {
    expect(count(words, (w) => w.level)).toEqual(EXPECTED.words);
    expect(dictionary).toHaveLength(EXPECTED.dictionary);
    expect(count(grammar, (g) => g.level)).toEqual(EXPECTED.grammar);
    expect(count(prompts, (p) => p.level)).toEqual(EXPECTED.prompts);
    expect(resources.length).toBeGreaterThanOrEqual(EXPECTED.resources.min);
    expect(resources.length).toBeLessThanOrEqual(EXPECTED.resources.max);
  });
});

describe("keys and duplicates", () => {
  for (const name of Object.keys(CONTENT_FILES) as ContentFile[]) {
    it(`${name}.json has unique keys`, () => {
      const records = load<Record<string, unknown>>(name);
      const keys = records.map((r) => r[CONTENT_KEYS[name]]);
      expect(new Set(keys).size).toBe(keys.length);
    });
  }

  it("lists no word at two levels", () => {
    const levelsOf = new Map<string, Set<string>>();
    for (const w of words) {
      const k = `${w.term}|${w.reading}`;
      levelsOf.set(k, (levelsOf.get(k) ?? new Set()).add(w.level));
    }
    expect([...levelsOf].filter(([, l]) => l.size > 1).map(([k]) => k)).toEqual([]);
  });

  it("gives the seed one item per record (no two share a written form)", () => {
    const keys = [
      ...words.map((w) => `word:${dedupeKey("word", w.term, w.reading)}`),
      ...grammar.map((g) => `grammar:${dedupeKey("grammar", g.pattern)}`),
    ];
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  });

  it("keeps the keys of the sample records production already holds", () => {
    // The base shipped one-record samples and production seeded them. The seed matches records by
    // key, so each real record for the same thing must keep the sample's key to replace it.
    const keys: Record<ContentFile, string[]> = {
      kana: ["kana:hiragana:a", "kana:katakana:shi"],
      kanji: ["kanji:日"],
      "kanji-info": ["日"],
      words: ["word:食べる:たべる"],
      dictionary: ["1358280"],
      grammar: ["grammar:n5:te-mo-ii"],
      resources: ["res:jlpt-samples"],
      prompts: ["prompt:n5:self-intro"],
    };
    for (const name of Object.keys(keys) as ContentFile[]) {
      const have = new Set(load<Record<string, unknown>>(name).map((r) => r[CONTENT_KEYS[name]]));
      for (const k of keys[name]) expect(have.has(k), `${name} ${k}`).toBe(true);
    }
    expect(grammar.find((g) => g.slug === "grammar:n5:te-mo-ii")?.pattern).toBe("〜てもいいです");
  });

  it("uses each quiz question slug once", () => {
    const slugs = grammar.flatMap((g) => g.questions.map((q) => q.slug));
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("words", () => {
  it("every word has a reading, a meaning and a part of speech", () => {
    const missing = words.filter((w) => !w.reading.trim() || w.meanings.length === 0 || w.pos.length === 0);
    expect(missing.map((w) => w.slug)).toEqual([]);
  });

  it("readings are kana", () => {
    expect(words.filter((w) => !/^[ぁ-ゖァ-ヺー〜]+$/u.test(w.reading)).map((w) => `${w.slug} ${w.reading}`)).toEqual([]);
  });

  it("every N5 word has an example sentence that credits its source", () => {
    const n5 = words.filter((w) => w.level === "N5");
    expect(n5.filter((w) => !w.example).map((w) => w.slug)).toEqual([]);
    for (const w of n5) if (w.example?.source === "tatoeba") expect(w.example.tatoeba).toBeDefined();
  });
});

describe("grammar", () => {
  const n5 = grammar.filter((g) => g.level === "N5");

  it("every N5 point has at least 3 examples and 2 questions", () => {
    expect(n5.filter((g) => g.examples.length < 3).map((g) => g.slug)).toEqual([]);
    expect(n5.filter((g) => g.questions.length < 2).map((g) => g.slug)).toEqual([]);
  });

  it("every N5 point is a lesson: title, short meaning, how it's made, topic and a place in the order", () => {
    expect(n5.filter((g) => !g.title || !g.gloss || !g.formation || !g.topic).map((g) => g.slug)).toEqual([]);
    expect(n5.map((g) => g.order).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(n5.map((_, i) => i));
  });

  it("every example and question has exactly one blank", () => {
    for (const g of n5) {
      for (const e of g.examples) expect(blanks(e.ja), `${g.slug}: ${e.ja}`).toHaveLength(1);
      for (const q of g.questions) expect(blanks(q.ja), q.slug).toHaveLength(1);
    }
  });

  it("wrong options differ from the answer and from each other", () => {
    for (const q of grammar.flatMap((g) => g.questions)) {
      const answer = toPlain(blanks(q.ja)[0]);
      const wrong = q.wrong.map(toPlain);
      expect(wrong, q.slug).not.toContain(answer);
      expect(new Set(wrong).size, q.slug).toBe(3);
    }
  });

  it("confusables point at real grammar points", () => {
    const slugs = new Set(grammar.map((g) => g.slug));
    for (const g of grammar) for (const c of g.confusables) expect(slugs.has(c) && c !== g.slug, `${g.slug} → ${c}`).toBe(true);
  });

  it("every link comes from the checked link table", () => {
    const table = read<{ points: { slug: string; links: { url: string }[] }[] }>("./source/grammar-links.json");
    const checked = new Map(table.points.map((p) => [p.slug, new Set(p.links.map((l) => l.url))]));
    for (const g of grammar) {
      expect(g.links.length, g.slug).toBeGreaterThan(0);
      for (const l of g.links) expect(checked.get(g.slug)?.has(l.url), `${g.slug} ${l.url}`).toBe(true);
    }
  });
});

describe("furigana", () => {
  const all = japanese();

  it("ruby readings are kana only", () => {
    const bad = all.flatMap(({ where, text }) =>
      parseRuby(text.replace(/\[\[|\]\]/g, ""))
        .filter((s) => s.reading !== undefined && !/^[ぁ-ゖァ-ヺー]+$/u.test(s.reading))
        .map((s) => `${where}: {${s.text}|${s.reading}}`),
    );
    expect(bad).toEqual([]);
  });

  it("every run of kanji has ruby", () => {
    const kanjiChar = /[\p{Script=Han}々]/u;
    const bad = all.filter(({ text }) =>
      parseRuby(text.replace(/\[\[|\]\]/g, "")).some((s) => s.reading === undefined && kanjiChar.test(s.text)),
    );
    expect(bad.map((b) => `${b.where}: ${b.text}`)).toEqual([]);
  });
});

describe("resources", () => {
  it("every resource passed the link check", () => {
    const checked = read<{ links: { url: string; ok: boolean }[] }>("./source/resource-links.json");
    const ok = new Set(checked.links.filter((l) => l.ok).map((l) => l.url));
    expect(resources.filter((r) => !ok.has(r.url)).map((r) => r.url)).toEqual([]);
  });

  it("covers every skill and level", () => {
    expect(new Set(resources.map((r) => r.skill)).size).toBe(11);
    for (const level of [...LEVELS, "work"] as const) expect(resources.some((r) => r.levels.includes(level)), level).toBe(true);
  });
});
