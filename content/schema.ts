/**
 * The contract between the content pipeline and the app.
 *
 * `scripts/content/` builds `content/generated/<name>.json` (one top-level array per file) and
 * the seed runner in `src/db/` reads those files into the database. Both sides import this file,
 * so they can be built at the same time.
 *
 * Rules
 * - Every record has a key (`CONTENT_KEYS`): unique within its file, stable when the content is
 *   regenerated, and never reused for something else. The seed matches database rows by it.
 * - Japanese text that can show furigana uses ruby markup: "{食|た}べる" is 食 with た above it.
 *   Text outside braces is plain. A reading may cover several characters: "{今日|きょう}".
 * - Grammar examples and questions mark the fill-in answer once with double brackets:
 *   "{雨|あめ}が{降|ふ}っている[[から]]、…". The answer may contain ruby.
 * - Adding an optional field is safe. Renaming or removing a field breaks the seed, so change
 *   both sides in the same PR.
 */
import { z } from "zod";

export const LEVELS = ["N5", "N4", "N3"] as const;
export const Level = z.enum(LEVELS);
export type Level = z.infer<typeof Level>;

/** Work Japanese content sits next to the JLPT levels. */
export const LevelOrWork = z.enum([...LEVELS, "work"]);
export type LevelOrWork = z.infer<typeof LevelOrWork>;

export const POS = [
  "noun",
  "pronoun",
  "verb-ichidan",
  "verb-godan",
  "verb-suru",
  "verb-kuru",
  "verb-other",
  "i-adj",
  "na-adj",
  "no-adj",
  "adverb",
  "particle",
  "conjunction",
  "counter",
  "numeric",
  "prefix",
  "suffix",
  "auxiliary",
  "expression",
  "interjection",
  "other",
] as const;
export const Pos = z.enum(POS);
export type Pos = z.infer<typeof Pos>;

export const SKILLS = [
  "kana",
  "kanji",
  "grammar",
  "vocabulary",
  "listening",
  "reading",
  "speaking",
  "jlpt",
  "business",
  "it",
  "general",
] as const;
export const Skill = z.enum(SKILLS);
export type Skill = z.infer<typeof Skill>;

// ---------------------------------------------------------------------------
// Ruby and fill-in markup

export type RubySegment = { text: string; reading?: string };

const RUBY_RE = /\{([^{}|]+)\|([^{}|]+)\}/g;
const BLANK_RE = /\[\[([^[\]]+)\]\]/g;

/** Splits "{食|た}べる" into [{ text: "食", reading: "た" }, { text: "べる" }]. */
export function parseRuby(text: string): RubySegment[] {
  const out: RubySegment[] = [];
  let last = 0;
  for (const m of text.matchAll(RUBY_RE)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[1], reading: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** True when every "{base|reading}" pairs up and no stray braces or pipes are left. */
export function isValidRuby(text: string): boolean {
  return !/[{}|]/.test(text.replace(RUBY_RE, ""));
}

/** The answers marked with [[…]], in order. */
export function blanks(text: string): string[] {
  return [...text.matchAll(BLANK_RE)].map((m) => m[1]);
}

/** Plain Japanese for display without furigana or for the voice: no ruby, blanks filled in. */
export function toPlain(text: string): string {
  return text.replace(BLANK_RE, "$1").replace(RUBY_RE, "$1");
}

const nonEmpty = z.string().trim().min(1);
const oneChar = z.string().refine((s) => [...s].length === 1, "one character");
const keyed = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}:\\S+$`), `must start with "${prefix}:" and have no spaces`);

/** Japanese that may carry ruby markup. */
const jaText = nonEmpty.refine(isValidRuby, "broken ruby markup");
/** Japanese with exactly one [[answer]] and valid ruby. */
const jaWithBlank = jaText.refine(
  (s) => blanks(s).length === 1 && !/\[\[|\]\]/.test(s.replace(BLANK_RE, "")),
  "needs exactly one [[answer]]",
);

const MiniWord = z.object({ term: nonEmpty, reading: nonEmpty, meaning: nonEmpty });

// ---------------------------------------------------------------------------
// Records

/** An example sentence. Tatoeba sentences keep their ids for the credit link on the card. */
export const Example = z
  .object({
    ja: jaText,
    en: nonEmpty,
    source: z.enum(["tatoeba", "michi"]),
    tatoeba: z
      .object({
        ja: z.number().int().positive(),
        en: z.number().int().positive(),
        /** Who added the Japanese sentence. */
        author: z.string().optional(),
        /** Who added the English sentence. */
        enAuthor: z.string().optional(),
      })
      .optional(),
  })
  .refine((e) => e.source !== "tatoeba" || e.tatoeba !== undefined, "Tatoeba examples need their sentence ids");
export type Example = z.infer<typeof Example>;

export const Kana = z.object({
  slug: keyed("kana"),
  script: z.enum(["hiragana", "katakana"]),
  group: z.enum(["basic", "dakuten", "combo", "extended"]),
  kana: nonEmpty,
  /** The answer shown, in Hepburn: shi, chi, tsu, fu, ji. */
  romaji: nonEmpty,
  /** Other typings that count as right: si, ti, tu, hu, zi. */
  accept: z.array(nonEmpty).default([]),
  /** Kana often confused with this one (シ and ツ). */
  lookalikes: z.array(nonEmpty).default([]),
  example: MiniWord.optional(),
});
export type Kana = z.infer<typeof Kana>;

export const Kanji = z.object({
  slug: keyed("kanji"),
  kanji: oneChar,
  level: Level,
  meanings: z.array(nonEmpty).min(1),
  /** In katakana. */
  on: z.array(nonEmpty),
  /** In hiragana, okurigana after a dot: "た.べる". */
  kun: z.array(nonEmpty),
  strokes: z.number().int().positive(),
  examples: z.array(MiniWord).max(2),
  lookalikes: z.array(oneChar).default([]),
});
export type Kanji = z.infer<typeof Kanji>;

/** Every jōyō kanji, read-only, for auto-fill. Keyed by the character. */
export const KanjiInfo = z.object({
  kanji: oneChar,
  meanings: z.array(nonEmpty).min(1),
  on: z.array(nonEmpty),
  kun: z.array(nonEmpty),
  strokes: z.number().int().positive(),
  grade: z.number().int().min(1).max(8).nullable(),
  jlpt: Level.nullable(),
});
export type KanjiInfo = z.infer<typeof KanjiInfo>;

export const Word = z.object({
  slug: keyed("word"),
  level: Level,
  /** As usually written: kanji, or kana for words usually written in kana. */
  term: nonEmpty,
  /** In kana. */
  reading: nonEmpty,
  meanings: z.array(nonEmpty).min(1),
  pos: z.array(Pos).min(1),
  usuallyKana: z.boolean().default(false),
  jmdictId: z.string().regex(/^\d+$/).optional(),
  example: Example.optional(),
});
export type Word = z.infer<typeof Word>;

/** JMdict common words, read-only, for auto-fill. Keyed by the JMdict sequence number. */
export const DictionaryEntry = z.object({
  id: z.string().regex(/^\d+$/),
  /** Written forms, most common first. Empty for kana-only words. */
  kanji: z.array(nonEmpty),
  kana: z.array(nonEmpty).min(1),
  meanings: z.array(nonEmpty).min(1),
  pos: z.array(Pos),
});
export type DictionaryEntry = z.infer<typeof DictionaryEntry>;

export const GrammarLink = z.object({
  site: z.enum(["jlptsensei", "bunpro"]),
  url: z.url(),
});

export const GrammarExample = z.object({ ja: jaWithBlank, en: nonEmpty });

/** A hand-written quiz question; the [[answer]] in `ja` is the right option. */
export const GrammarQuestion = z.object({
  slug: keyed("gq"),
  ja: jaWithBlank,
  en: nonEmpty,
  wrong: z.array(nonEmpty).length(3),
  explain: nonEmpty.optional(),
});

export const Grammar = z.object({
  slug: keyed("grammar"),
  level: Level,
  /** As learners know it: "〜てもいいです". */
  pattern: nonEmpty,
  /** Written fresh, one or two lines. */
  meaning: nonEmpty,
  links: z.array(GrammarLink).min(1),
  examples: z.array(GrammarExample).default([]),
  questions: z.array(GrammarQuestion).default([]),
  /** Slugs of points that are easy to mix up with this one (から / ので / のに). */
  confusables: z.array(keyed("grammar")).default([]),
  /** The lesson's title, in Japanese where it can be (may hold ruby): "〜てください", "だ / です". */
  title: nonEmpty.optional(),
  /** The lesson's short meaning, for lists: "please do …". Written fresh; N5 for now. */
  gloss: nonEmpty.optional(),
  /** How it's made, in English with Japanese (may hold ruby): "verb て-form + ください". */
  formation: nonEmpty.optional(),
  /** The lesson group it's taught in: "Permission and rules". */
  topic: nonEmpty.optional(),
  /** Its place in the learning order within its level, from 0. */
  order: z.int().min(0).optional(),
});
export type Grammar = z.infer<typeof Grammar>;

export const Resource = z.object({
  slug: keyed("res"),
  title: nonEmpty,
  url: z.url(),
  skill: Skill,
  levels: z.array(LevelOrWork).min(1),
  free: z.boolean(),
  notes: z.string().default(""),
});
export type Resource = z.infer<typeof Resource>;

/** A speaking prompt with a model answer to compare against. */
export const Prompt = z.object({
  slug: keyed("prompt"),
  level: LevelOrWork,
  /** The task, in English. */
  prompt: nonEmpty,
  /** Patterns to try, may carry ruby. */
  hints: z.array(jaText).default([]),
  model: jaText,
  modelEn: nonEmpty,
});
export type Prompt = z.infer<typeof Prompt>;

/** A shadowing set: short sentences to hear and say along with the voice (F_Shadowing). */
export const Shadowing = z.object({
  slug: keyed("shadow"),
  level: Level,
  /** In English, for lists and the player's top line: "Daily life". */
  title: nonEmpty,
  /** Japanese with ruby markup, each with its English. */
  sentences: z.array(z.object({ ja: jaText, en: nonEmpty })).min(8).max(10),
});
export type Shadowing = z.infer<typeof Shadowing>;

// ---------------------------------------------------------------------------
// Files

export const CONTENT_FILES = {
  kana: z.array(Kana),
  kanji: z.array(Kanji),
  "kanji-info": z.array(KanjiInfo),
  words: z.array(Word),
  dictionary: z.array(DictionaryEntry),
  grammar: z.array(Grammar),
  resources: z.array(Resource),
  prompts: z.array(Prompt),
  shadowing: z.array(Shadowing),
} as const;
export type ContentFile = keyof typeof CONTENT_FILES;

/** The field that identifies a record in each file. */
export const CONTENT_KEYS = {
  kana: "slug",
  kanji: "slug",
  "kanji-info": "kanji",
  words: "slug",
  dictionary: "id",
  grammar: "slug",
  resources: "slug",
  prompts: "slug",
  shadowing: "slug",
} as const satisfies Record<ContentFile, string>;

/** Path from the repo root. */
export const contentPath = (name: ContentFile) => `content/generated/${name}.json`;
