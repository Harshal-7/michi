/**
 * `pnpm content:build`: builds content/generated/*.json from the pinned sources and the committed
 * inputs in content/source/, checks everything, and writes the files only when every check passes.
 *
 *   --force             write the files even when checks fail (for work in progress)
 *   --update-sources    accept new upstream bytes for a source whose hash changed (see lib/sources.ts)
 */
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
  CONTENT_FILES,
  CONTENT_KEYS,
  type ContentFile,
  contentPath,
  type Grammar,
  LEVELS,
  type Level,
  parseRuby,
  type Prompt,
  toPlain,
  type Resource,
  type Shadowing,
} from "../../content/schema";
import { dedupeKey } from "../../src/lib/items/dedupe";
import { buildDictionary } from "./dictionary";
import { attachExamples } from "./examples";
import { buildKana } from "./kana";
import { buildKanji, buildKanjiInfo } from "./kanji";
import { checkJa } from "./lib/check-ja";
import { EXPECTED } from "./lib/expected";
import { JmIndex, loadJmdict } from "./lib/jmdict";
import { allowedKanjiByLevel, loadDecks, loadKanjiData } from "./lib/load";
import { GENERATED, ROOT, SOURCE } from "./lib/paths";
import { kanjiReadings, type KanjiReadings, plausible } from "./lib/ruby";
import {
  GrammarLinkTable,
  GrammarMeanings,
  GrammarLessons,
  GrammarWritten,
  LookalikeGroups,
  PromptsSource,
  ResourceLinkTable,
  ResourcesSource,
  ShadowingSource,
  WordExamples,
} from "./lib/source-types";
import { writeLines, writePretty } from "./lib/write";
import { buildWords } from "./words";

const problems: string[] = [];
const warnings: string[] = [];
const problem = (msg: string) => problems.push(msg);

function readSource<T>(file: string, schema: { parse: (v: unknown) => T }, fallback?: T): T {
  let raw: string;
  try {
    raw = readFileSync(path.join(SOURCE, file), "utf8");
  } catch {
    if (fallback !== undefined) {
      problem(`content/source/${file} is missing`);
      return fallback;
    }
    throw new Error(`content/source/${file} is missing`);
  }
  return schema.parse(JSON.parse(raw));
}

/** Readings in hand-written ruby that neither KANJIDIC nor JMdict explains, for a human to look at. */
function oddRuby(text: string, kr: KanjiReadings, dict: JmIndex): string[] {
  const segs = parseRuby(text.replace(/\[\[|\]\]/g, ""));
  return segs
    .filter((s, i) => {
      if (!s.reading || plausible(s.text, s.reading, kr) || dict.has(s.text, s.reading)) return false;
      // Words like お腹 (おなか) only read that way with their prefix.
      const before = segs[i - 1]?.reading === undefined ? (segs[i - 1]?.text.slice(-1) ?? "") : "";
      return !(before && dict.has(before + s.text, before + s.reading));
    })
    .map((s) => `{${s.text}|${s.reading}}`);
}

function checkWritten(where: string, text: string, opts: { level: Level; blank?: boolean }, ctx: Ctx) {
  for (const p of checkJa(text, { allowedKanji: ctx.allowed[opts.level], needsBlank: opts.blank })) problem(`${where}: ${p} ← ${text}`);
  const odd = oddRuby(text, ctx.kr, ctx.dict);
  if (odd.length) warnings.push(`${where}: check reading ${odd.join(" ")} ← ${text}`);
}

type Ctx = { allowed: Record<Level, Set<string>>; kr: KanjiReadings; dict: JmIndex };

function buildGrammar(ctx: Ctx): Grammar[] {
  const table = readSource("grammar-links.json", GrammarLinkTable);
  const written = ["grammar-n5-a.json", "grammar-n5-b.json", "grammar-n5-c.json"].flatMap((f) => readSource(f, GrammarWritten, []));
  const meanings = readSource("grammar-meanings.json", GrammarMeanings, []);
  const writtenBySlug = new Map(written.map((g) => [g.slug, g]));
  const meaningBySlug = new Map(meanings.map((g) => [g.slug, g]));
  const known = new Set(table.points.map((p) => p.slug));
  for (const g of [...written, ...meanings]) if (!known.has(g.slug)) problem(`grammar ${g.slug} isn't in the link table`);

  const lessons = readSource("grammar-lessons.json", GrammarLessons, []);
  const lessonBySlug = new Map<string, { topic: string; title: string; gloss: string; formation: string; order: number }>();
  for (const { topic, points } of lessons) {
    for (const p of points) {
      if (lessonBySlug.has(p.slug)) problem(`grammar-lessons.json lists ${p.slug} twice`);
      if (!writtenBySlug.has(p.slug)) problem(`grammar-lessons.json: ${p.slug} isn't a written N5 point`);
      checkWritten(`${p.slug} title`, p.title, { level: "N5" }, ctx);
      checkWritten(`${p.slug} formation`, p.formation, { level: "N5" }, ctx);
      lessonBySlug.set(p.slug, { topic, title: p.title, gloss: p.gloss, formation: p.formation, order: lessonBySlug.size });
    }
  }

  const questionSlugs = new Set<string>();
  const out: Grammar[] = [];
  for (const point of table.points) {
    if (point.links.length === 0) problem(`grammar ${point.slug} has no working link`);
    if (point.level === "N5") {
      const g = writtenBySlug.get(point.slug);
      if (!g) {
        problem(`grammar ${point.slug} (${point.title}) isn't written yet`);
        continue;
      }
      if (g.examples.length < 3) problem(`grammar ${g.slug} needs at least 3 examples`);
      if (g.questions.length < 2) problem(`grammar ${g.slug} needs at least 2 questions`);
      g.examples.forEach((e, i) => checkWritten(`${g.slug} example ${i + 1}`, e.ja, { level: "N5", blank: true }, ctx));
      for (const q of g.questions) {
        if (questionSlugs.has(q.slug)) problem(`question slug ${q.slug} is used twice`);
        questionSlugs.add(q.slug);
        checkWritten(q.slug, q.ja, { level: "N5", blank: true }, ctx);
        for (const w of q.wrong) checkWritten(`${q.slug} wrong option`, w, { level: "N5" }, ctx);
      }
      for (const c of g.confusables) if (!known.has(c) || c === g.slug) problem(`grammar ${g.slug} lists unknown confusable ${c}`);
      const lesson = lessonBySlug.get(g.slug);
      if (!lesson) problem(`grammar ${g.slug} isn't in grammar-lessons.json`);
      out.push({ ...g, level: "N5", links: point.links, ...lesson });
    } else {
      const m = meaningBySlug.get(point.slug);
      if (!m) {
        problem(`grammar ${point.slug} (${point.title}) has no meaning yet`);
        continue;
      }
      out.push({
        slug: point.slug,
        level: point.level,
        pattern: m.pattern,
        meaning: m.meaning,
        links: point.links,
        examples: [],
        questions: [],
        confusables: [],
      });
    }
  }
  return out;
}

function buildResources(): Resource[] {
  const resources = readSource("resources.json", ResourcesSource);
  const checked = readSource("resource-links.json", ResourceLinkTable, { links: [] });
  const ok = new Set(checked.links.filter((l) => l.ok).map((l) => l.url));
  for (const r of resources) if (!ok.has(r.url)) problem(`resource ${r.slug} (${r.url}) hasn't passed the link check`);
  return resources;
}

function buildPrompts(ctx: Ctx): Prompt[] {
  const prompts = readSource("prompts.json", PromptsSource, []);
  for (const p of prompts) {
    if (p.level === "work") continue;
    checkWritten(`${p.slug} model`, p.model, { level: p.level }, ctx);
    for (const h of p.hints) checkWritten(`${p.slug} hint`, h, { level: p.level }, ctx);
  }
  return prompts;
}

function buildShadowing(ctx: Ctx): Shadowing[] {
  const sets = readSource("shadowing.json", ShadowingSource, []);
  for (const s of sets) s.sentences.forEach((x, i) => checkWritten(`${s.slug} sentence ${i + 1}`, x.ja, { level: s.level }, ctx));
  return sets;
}

const countBy = <T>(items: T[], key: (t: T) => string) => {
  const out: Record<string, number> = {};
  for (const i of items) out[key(i)] = (out[key(i)] ?? 0) + 1;
  return out;
};

function expectCounts(name: string, got: Record<string, number>, want: Record<string, number>) {
  for (const [k, n] of Object.entries(want)) if ((got[k] ?? 0) !== n) problem(`${name} ${k}: expected ${n}, got ${got[k] ?? 0}`);
}

async function main() {
  const force = process.argv.includes("--force");
  console.log("Loading sources…");
  const [kanjiData, decks, jmFull, jmCommon, allowed] = await Promise.all([
    loadKanjiData(),
    loadDecks(),
    loadJmdict("full"),
    loadJmdict("common"),
    allowedKanjiByLevel(),
  ]);
  const dict = new JmIndex(jmFull);
  const kr = kanjiReadings(kanjiData);
  const ctx: Ctx = { allowed, kr, dict };

  console.log("Words…");
  const { matched, unmatched, dropped } = buildWords(decks, dict);
  for (const d of dropped) console.log(`  kept at the lower level only: ${d}`);
  if (unmatched.length) warnings.push(`words without a JMdict match (${unmatched.length}): ${unmatched.join(", ")}`);

  console.log("Examples…");
  const michiExamples = readSource("word-examples.json", WordExamples, []);
  const wordLevel = new Map(matched.map((m) => [m.word.slug, m.word.level]));
  for (const e of michiExamples) {
    const level = wordLevel.get(e.word);
    if (!level) problem(`word-examples.json: unknown word ${e.word}`);
    else checkWritten(`example for ${e.word}`, e.ja, { level }, ctx);
    const w = matched.find((m) => m.word.slug === e.word)?.word;
    const plain = toPlain(e.ja);
    if (w && !plain.includes(w.term.replace(/〜/g, "").slice(0, 1)) && !plain.includes(w.reading.replace(/〜/g, "").slice(0, 2)))
      warnings.push(`example for ${e.word} may not use the word: ${e.ja}`);
  }
  const exampleStats = await attachExamples(matched, dict, kr, new Map(michiExamples.map((e) => [e.word, e])));
  for (const slug of exampleStats.missingN5) problem(`N5 word ${slug} has no example`);
  const words = matched.map((m) => m.word);

  console.log("Kana, kanji, dictionary…");
  const n5 = words.filter((w) => w.level === "N5").map((w) => ({ term: w.term, reading: w.reading, meaning: w.meanings[0] }));
  const kana = buildKana(n5);
  const lookalikes = readSource("kanji-lookalikes.json", LookalikeGroups, []);
  const kanji = buildKanji(kanjiData, words, kr, lookalikes);
  const kanjiInfo = buildKanjiInfo(kanjiData);
  const dictionary = buildDictionary(jmCommon);

  console.log("Grammar, resources, prompts, shadowing…");
  const grammar = buildGrammar(ctx);
  const resources = buildResources();
  const prompts = buildPrompts(ctx);
  const shadowing = buildShadowing(ctx);

  // Counts
  expectCounts("kana", countBy(kana, (k) => k.script), EXPECTED.kana);
  expectCounts("kanji", countBy(kanji, (k) => k.level), EXPECTED.kanji);
  expectCounts("words", countBy(words, (w) => w.level), EXPECTED.words);
  expectCounts("grammar", countBy(grammar, (g) => g.level), EXPECTED.grammar);
  expectCounts("prompts", countBy(prompts, (p) => p.level), EXPECTED.prompts);
  expectCounts("shadowing", countBy(shadowing, (s) => s.level), EXPECTED.shadowing);
  if (kanjiInfo.length !== EXPECTED.kanjiInfo) problem(`kanji-info: expected ${EXPECTED.kanjiInfo}, got ${kanjiInfo.length}`);
  if (dictionary.length !== EXPECTED.dictionary) problem(`dictionary: expected ${EXPECTED.dictionary}, got ${dictionary.length}`);
  if (resources.length < EXPECTED.resources.min || resources.length > EXPECTED.resources.max)
    problem(`resources: expected about 45, got ${resources.length}`);

  // Contract: every file parses and its keys are unique.
  const files = { kana, kanji, "kanji-info": kanjiInfo, words, dictionary, grammar, resources, prompts, shadowing } satisfies Record<ContentFile, unknown[]>;
  const parsed = {} as Record<ContentFile, unknown[]>;
  for (const name of Object.keys(files) as ContentFile[]) {
    const result = CONTENT_FILES[name].safeParse(files[name]);
    if (!result.success) {
      problem(`${name}: ${result.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      continue;
    }
    parsed[name] = result.data as unknown[];
    const keys = (result.data as Record<string, unknown>[]).map((r) => r[CONTENT_KEYS[name]]);
    if (new Set(keys).size !== keys.length) problem(`${name}: duplicate keys`);
  }

  // The seed treats records with the same written form as one item, so each must be distinct.
  const seedKeys = [
    ...words.map((w) => ({ key: `word:${dedupeKey("word", w.term, w.reading)}`, slug: w.slug })),
    ...grammar.map((g) => ({ key: `grammar:${dedupeKey("grammar", g.pattern)}`, slug: g.slug })),
  ];
  const owner = new Map<string, string>();
  for (const { key, slug } of seedKeys) {
    if (owner.has(key)) problem(`${slug} and ${owner.get(key)} would be one item in the app (same form ${key})`);
    else owner.set(key, slug);
  }

  for (const w of warnings) console.log(`warning: ${w}`);
  const n5WithExample = words.filter((w) => w.level === "N5" && w.example).length;
  console.log(
    `Examples: Tatoeba N5 ${exampleStats.tatoeba.N5}, N4 ${exampleStats.tatoeba.N4}, N3 ${exampleStats.tatoeba.N3}; written ${exampleStats.michi}; N5 with an example ${n5WithExample}/${EXPECTED.words.N5}`,
  );

  if (problems.length) {
    for (const p of problems) console.log(`problem: ${p}`);
    console.log(`${problems.length} problem(s).`);
    if (!force) {
      console.log("Nothing written. Fix the problems, or pass --force to write anyway.");
      process.exit(1);
    }
  }

  const big = new Set<ContentFile>(["kana", "kanji", "kanji-info", "words", "dictionary"]);
  let total = 0;
  for (const name of Object.keys(files) as ContentFile[]) {
    const file = path.join(ROOT, contentPath(name));
    const data = parsed[name] ?? files[name];
    if (big.has(name)) writeLines(file, data);
    else writePretty(file, data);
    const size = statSync(file).size;
    total += size;
    console.log(`  ${contentPath(name).padEnd(36)} ${String(data.length).padStart(6)} records ${(size / 1024).toFixed(0).padStart(6)} KB`);
  }
  console.log(`  total ${(total / 1024 / 1024).toFixed(2)} MB in ${path.relative(ROOT, GENERATED)}/`);
  console.log(
    `Counts: kana ${kana.length} (hiragana ${countBy(kana, (k) => k.script).hiragana}, katakana ${countBy(kana, (k) => k.script).katakana}); ` +
      `kanji ${LEVELS.map((l) => countBy(kanji, (k) => k.level)[l] ?? 0).join(" / ")} (+${kanjiInfo.length} jōyō); ` +
      `words ${LEVELS.map((l) => countBy(words, (w) => w.level)[l] ?? 0).join(" / ")}; dictionary ${dictionary.length}; ` +
      `grammar ${LEVELS.map((l) => countBy(grammar, (g) => g.level)[l] ?? 0).join(" / ")}; resources ${resources.length}; prompts ${prompts.length}; shadowing ${shadowing.length}`,
  );
  if (problems.length) process.exit(1);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
