/** What can be logged here, with labels. Plain constants, so the form can use them in the browser. */

/** Kinds you log here; class minutes come from the class log. */
export const LOGGABLE_KINDS = ["listening", "speaking", "shadowing", "reading", "immersion", "study", "other"] as const;
export type LoggableKind = (typeof LOGGABLE_KINDS)[number];

/** In step with `activity_skill` in src/db/schema.ts (data.test.ts checks). */
export const SKILLS = ["listening", "speaking", "reading", "vocabulary", "kanji", "grammar", "general"] as const;
export type Skill = (typeof SKILLS)[number];

export const KIND_LABELS: Record<LoggableKind | "class", string> = {
  class: "Class",
  speaking: "Speaking",
  shadowing: "Shadowing",
  listening: "Listening",
  reading: "Reading",
  immersion: "Immersion",
  study: "Study",
  other: "Other",
};

export const SKILL_LABELS: Record<Skill, string> = {
  listening: "Listening",
  speaking: "Speaking",
  reading: "Reading",
  vocabulary: "Vocabulary",
  kanji: "Kanji",
  grammar: "Grammar",
  general: "General",
};

/** The skill a kind counts towards unless you pick another. */
export const DEFAULT_SKILL: Record<LoggableKind, Skill> = {
  listening: "listening",
  speaking: "speaking",
  shadowing: "speaking",
  reading: "reading",
  immersion: "listening",
  study: "general",
  other: "general",
};

export function isLoggableKind(value: unknown): value is LoggableKind {
  return LOGGABLE_KINDS.includes(value as LoggableKind);
}
