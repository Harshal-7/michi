/**
 * A quiz question as it was asked, frozen in `questions.asked` (the plan's "Quiz and test
 * questions"). Everything the screen shows is in here, so a later change to the content never
 * changes an old question, and you can see which kinds of question you miss.
 *
 * Japanese text (`ja`, options, `say`) may carry ruby markup (content/schema.ts). Two marks of
 * our own: `⟨word⟩` is the underlined word (kanji reading, spelling), shown without furigana;
 * `[[answer]]` is a blank, shown as a gap.
 */
import { z } from "zod";

export const QUIZ_TYPES = [
  "kana",
  "kanji_reading",
  "spelling",
  "meaning",
  "meaning_reverse",
  "word_in_context",
  "grammar_fill",
  "sentence_order",
  "listening",
] as const;
export type QuizType = (typeof QUIZ_TYPES)[number];

/** The chip on a question and on the results (F_QuizQuestion, F_Quiz). */
export const TYPE_LABEL: Record<QuizType, string> = {
  kana: "Kana",
  kanji_reading: "Kanji reading",
  spelling: "Spelling",
  meaning: "Meaning",
  meaning_reverse: "Meaning",
  word_in_context: "Word in context",
  grammar_fill: "Grammar fill-in",
  sentence_order: "Sentence order",
  listening: "Listening",
};

/** The shorter name on the results' score chips: "Grammar 1/2". */
export const TYPE_SHORT: Record<QuizType, string> = {
  ...TYPE_LABEL,
  meaning_reverse: "Meaning",
  grammar_fill: "Grammar",
  sentence_order: "Order",
};

export const UNDERLINE = /⟨([^⟨⟩]+)⟩/;

export const Asked = z.object({
  v: z.literal(1),
  type: z.enum(QUIZ_TYPES),
  /** What to do, in English: "How do you read the underlined word?" */
  instruction: z.string().min(1),
  /** The Japanese shown on the card: a sentence with ⟨word⟩ or a [[blank]], or one big term. */
  ja: z.string().optional(),
  /** Show `ja` big, on its own (a kana, a word). */
  big: z.boolean().optional(),
  /** English shown on the card (the meaning you match to a word). */
  en: z.string().optional(),
  /** Read aloud by the device's Japanese voice (listening). */
  say: z.string().optional(),
  /** Sentence order: the sentence around the four slots, and which slot has the ★. */
  order: z.object({ before: z.string(), after: z.string(), star: z.int().min(0).max(3) }).optional(),
  options: z.array(z.string().min(1)).length(4),
  optionsLang: z.enum(["ja", "en"]),
  /** The right option's index. */
  answer: z.int().min(0).max(3),
  /** Shown after answering; English that may hold Japanese with ruby. */
  explain: z.string().optional(),
  /** The full sentence, after answering (sentence order, word in context, listening). */
  full: z.object({ ja: z.string(), en: z.string() }).optional(),
});
export type Asked = z.infer<typeof Asked>;

export type QuizKind = "daily" | "weekly";
export const QUIZ_LENGTH: Record<QuizKind, number> = { daily: 10, weekly: 25 };
export const QUIZ_TITLE: Record<QuizKind, string> = { daily: "Daily quiz", weekly: "Weekly test" };
/** The listen drill on Practice. */
export const LISTEN_DRILL_LENGTH = 5;
