/**
 * The whole database, from the plan's "Database (Drizzle)" table, including the tables later
 * rounds fill. Anything the app filters, sorts or adds up is a column; content that depends
 * on an item's kind, frozen snapshots and config are jsonb checked by zod.
 *
 * Column names are snake_case in Postgres (`casing: "snake_case"` in src/db/client.ts and
 * drizzle.config.ts). Plain dates ("YYYY-MM-DD") are study dates from src/lib/day.ts.
 * After changing this file: `pnpm db:generate`, then `pnpm db:migrate`.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { ItemData } from "@/lib/items/data";

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const at = () => timestamp({ withTimezone: true });
const day = () => date({ mode: "string" });

// ---------------------------------------------------------------------------
// Enums

export const itemKind = pgEnum("item_kind", ["kana", "kanji", "word", "grammar", "phrase"]);
export const jlptLevel = pgEnum("jlpt_level", ["N5", "N4", "N3"]);
/** JLPT levels plus Work Japanese, for resources and speaking prompts. */
export const levelOrWork = pgEnum("level_or_work", ["N5", "N4", "N3", "work"]);
export const track = pgEnum("track", ["jlpt", "work"]);
export const itemSource = pgEnum("item_source", ["starter", "class", "import", "immersion", "manual"]);
export const deckSource = pgEnum("deck_source", ["starter", "class", "immersion", "user"]);
/** recognition: Japanese → meaning; production: meaning → Japanese; fill_in: a grammar blank. */
export const cardType = pgEnum("card_type", ["recognition", "production", "fill_in"]);
/** FSRS card states, in ts-fsrs order. */
export const cardState = pgEnum("card_state", ["new", "learning", "review", "relearning"]);
export const cardStatus = pgEnum("card_status", ["active", "suspended"]);
/** deadline: spread the list over the days left before its deadline; per_day: a fixed number. */
export const paceMode = pgEnum("pace_mode", ["deadline", "per_day"]);
export const reviewSource = pgEnum("review_source", ["session", "quiz", "quick_check"]);
export const quickCheckVerdict = pgEnum("quick_check_verdict", ["known", "unsure", "unknown"]);
export const assessmentKind = pgEnum("assessment_kind", ["daily", "weekly", "mock", "outside"]);
export const assessmentStatus = pgEnum("assessment_status", ["open", "submitted"]);
export const questionType = pgEnum("question_type", [
  "kana",
  "kanji_reading",
  "spelling",
  "meaning",
  "meaning_reverse",
  "word_in_context",
  "grammar_fill",
  "sentence_order",
  "paraphrase",
  "usage",
  "text_grammar",
  "reading",
  "listening",
]);
export const grammarStatus = pgEnum("grammar_status", ["not_started", "learning", "confident"]);
export const activityKind = pgEnum("activity_kind", [
  "class",
  "speaking",
  "shadowing",
  "listening",
  "reading",
  "immersion",
  "study",
  "other",
]);
export const activitySkill = pgEnum("activity_skill", [
  "listening",
  "speaking",
  "reading",
  "vocabulary",
  "kanji",
  "grammar",
  "general",
]);
export const immersionKind = pgEnum("immersion_kind", [
  "anime",
  "drama",
  "song",
  "podcast",
  "nhk_easy",
  "youtube",
  "book",
  "game",
  "other",
]);
export const subtitles = pgEnum("subtitles", ["none", "ja", "en"]);
export const resourceSkill = pgEnum("resource_skill", [
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
]);
export const resourceSource = pgEnum("resource_source", ["starter", "manual"]);
/** Per-date exceptions to the plan. */
export const overrideKind = pgEnum("override_kind", ["rest", "no_class", "exam"]);
export const taskMark = pgEnum("task_mark", ["done", "skipped"]);
export const flagStatus = pgEnum("flag_status", ["open", "resolved"]);

// ---------------------------------------------------------------------------
// What you study

/**
 * Everything you can study. `dedupe_key` (unique per kind) stops the same word being added
 * twice. Starter items also carry `seed_slug` (the content key), `seed_hash` (of the content
 * record they came from) and `user_edited_at`: the seed only updates an item whose content
 * changed and that you haven't edited.
 */
export const items = pgTable(
  "items",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    kind: itemKind().notNull(),
    level: jlptLevel(),
    track: track().notNull().default("jlpt"),
    term: text().notNull(),
    /** In kana; the romaji for a kana item; null for grammar. */
    reading: text(),
    meaning: text().notNull().default(""),
    source: itemSource().notNull(),
    data: jsonb().$type<ItemData>().notNull().default({}),
    dedupeKey: text().notNull(),
    seedSlug: text().unique(),
    seedHash: text(),
    userEditedAt: at(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex().on(t.kind, t.dedupeKey), index().on(t.kind, t.level)],
);

/** "Where I met it": the class or immersion sentence shown on the card. */
export const itemContexts = pgTable(
  "item_contexts",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    itemId: integer()
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    /** Japanese, may carry ruby markup. */
    ja: text().notNull(),
    en: text().notNull().default(""),
    classLogId: integer().references(() => classLogs.id, { onDelete: "set null" }),
    immersionEntryId: integer().references(() => immersionEntries.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.itemId)],
);

/**
 * Named sets of items. A deck is on when `active` is true, or once `unlock_on` has come
 * (src/lib/decks.ts); the Decks page can switch it either way. A word in two decks is still
 * one item with one schedule.
 */
export const decks = pgTable("decks", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /** Starter decks have a fixed slug the seed finds them by. */
  slug: text().unique(),
  name: text().notNull(),
  source: deckSource().notNull(),
  /** What a starter deck holds. */
  kind: itemKind(),
  level: jlptLevel(),
  track: track().notNull().default("jlpt"),
  active: boolean().notNull().default(false),
  unlockOn: day(),
  paceMode: paceMode().notNull().default("deadline"),
  pacePerDay: smallint(),
  /** Overrides the level's deadline from settings. */
  deadline: day(),
  cardTypes: cardType().array().notNull().default(sql`'{recognition}'`),
  position: integer().notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const deckItems = pgTable(
  "deck_items",
  {
    deckId: integer()
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    itemId: integer()
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    position: integer().notNull().default(0),
    addedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.deckId, t.itemId] }), index().on(t.itemId)],
);

/**
 * One card per item and card type. `fsrs` holds the ts-fsrs card; the columns next to it are
 * copies written in the same statement, for the due queue and stats. A new card has no FSRS
 * state yet. Cards are only ever added: re-seeding never touches an existing card.
 */
export const cards = pgTable(
  "cards",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    itemId: integer()
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    cardType: cardType().notNull(),
    status: cardStatus().notNull().default("active"),
    state: cardState().notNull().default("new"),
    fsrs: jsonb().$type<Record<string, unknown>>(),
    dueAt: at(),
    stability: real(),
    difficulty: real(),
    reps: integer().notNull().default(0),
    lapses: integer().notNull().default(0),
    lastReviewAt: at(),
    /** The review the stored state came from; a grade from a device that saw another one is stale. */
    lastReviewId: uuid(),
    /** Order in the new queue (lower first). */
    newRank: integer().notNull().default(0),
    introducedOn: day(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex().on(t.itemId, t.cardType),
    index("cards_due_idx").on(t.dueAt).where(sql`${t.status} = 'active' and ${t.state} <> 'new'`),
    index("cards_new_idx").on(t.newRank).where(sql`${t.status} = 'active' and ${t.state} = 'new'`),
  ],
);

/**
 * Every grade, never edited, only added to (undo sets `voided_at`). The id is made on the
 * device, so a retried grade is saved once. `study_date` is worked out by Postgres the same
 * way src/lib/day.ts does: India time, the day starting at 4 am (UTC + 1:30).
 */
export const reviewLogs = pgTable(
  "review_logs",
  {
    id: uuid().primaryKey(),
    cardId: integer()
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    /** 1 Again, 2 Hard, 3 Good, 4 Easy. */
    rating: smallint().notNull(),
    reviewedAt: at().notNull(),
    durationMs: integer(),
    source: reviewSource().notNull(),
    studyDate: day()
      .notNull()
      .generatedAlwaysAs(sql`(((reviewed_at at time zone 'UTC') + interval '90 minutes')::date)`),
    /** The card as it was before this grade, so undo can put it back. */
    cardBefore: jsonb().$type<Record<string, unknown>>().notNull(),
    /** The ts-fsrs review log. */
    log: jsonb().$type<Record<string, unknown>>(),
    voidedAt: at(),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.cardId, t.reviewedAt),
    index().on(t.studyDate),
    check("review_logs_rating", sql`${t.rating} between 1 and 4`),
  ],
);

/** The quick check's verdict per item, and whether a "Knew it" passed its spot check. */
export const quickCheck = pgTable("quick_check", {
  itemId: integer()
    .primaryKey()
    .references(() => items.id, { onDelete: "cascade" }),
  verdict: quickCheckVerdict().notNull(),
  /** null until (unless) the multiple-choice spot check asks about it. */
  verified: boolean(),
  checkedAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Quizzes and tests

/**
 * Daily quizzes, weekly tests, mocks and outside scores. One daily quiz per date, one weekly
 * test per week and one open mock per level.
 */
export const assessments = pgTable(
  "assessments",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    kind: assessmentKind().notNull(),
    level: jlptLevel(),
    status: assessmentStatus().notNull().default("open"),
    studyDate: day().notNull(),
    /** The Monday of a weekly test's week. */
    weekStart: day(),
    startedAt: createdAt(),
    submittedAt: at(),
    score: integer(),
    total: integer(),
    /** Raw section scores for mocks and outside tests. */
    sections: jsonb().$type<Record<string, { score: number; total: number }>>(),
    /** Where an outside score came from (a book, the official workbook). */
    outsideSource: text(),
    notes: text().notNull().default(""),
  },
  (t) => [
    uniqueIndex("assessments_one_daily_per_date").on(t.studyDate).where(sql`${t.kind} = 'daily'`),
    uniqueIndex("assessments_one_weekly_per_week").on(t.weekStart).where(sql`${t.kind} = 'weekly'`),
    uniqueIndex("assessments_one_open_mock_per_level")
      .on(t.level)
      .where(sql`${t.kind} = 'mock' and ${t.status} = 'open'`),
    index().on(t.kind, t.studyDate),
  ],
);

/** Hand-written reading passages. */
export const passages = pgTable("passages", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  seedSlug: text().unique(),
  level: jlptLevel().notNull(),
  title: text().notNull(),
  /** Japanese with ruby markup. */
  body: text().notNull(),
  translation: text().notNull().default(""),
  data: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  seedHash: text(),
  userEditedAt: at(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Hand-written paraphrase, usage, text-grammar, reading and listening questions. */
export const questionBank = pgTable(
  "question_bank",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    seedSlug: text().unique(),
    level: jlptLevel().notNull(),
    type: questionType().notNull(),
    passageId: integer().references(() => passages.id, { onDelete: "cascade" }),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
    seedHash: text(),
    userEditedAt: at(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.level, t.type)],
);

/** Each question frozen as it was asked, with your answer. */
export const questions = pgTable(
  "questions",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    assessmentId: integer()
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    type: questionType().notNull(),
    /** The mock section it belongs to. */
    section: text(),
    itemId: integer().references(() => items.id, { onDelete: "set null" }),
    bankQuestionId: integer().references(() => questionBank.id, { onDelete: "set null" }),
    /** Prompt, options and the right answer, as shown. */
    asked: jsonb().$type<Record<string, unknown>>().notNull(),
    answer: text(),
    correct: boolean(),
    answeredAt: at(),
  },
  (t) => [uniqueIndex().on(t.assessmentId, t.position), index().on(t.itemId), index().on(t.type, t.correct)],
);

// ---------------------------------------------------------------------------
// Logs

export const classLogs = pgTable(
  "class_logs",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    date: day().notNull(),
    lesson: text().notNull().default(""),
    topics: text().array().notNull().default(sql`'{}'`),
    notes: text().notNull().default(""),
    /** What was typed, so the log can be processed again safely. */
    input: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.date)],
);

export const classLogEntries = pgTable(
  "class_log_entries",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    classLogId: integer()
      .notNull()
      .references(() => classLogs.id, { onDelete: "cascade" }),
    kind: itemKind().notNull(),
    position: smallint().notNull().default(0),
    input: jsonb().$type<Record<string, unknown>>().notNull(),
    /** The item it made or linked to. */
    itemId: integer().references(() => items.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.classLogId), index().on(t.itemId)],
);

export const grammarProgress = pgTable("grammar_progress", {
  itemId: integer()
    .primaryKey()
    .references(() => items.id, { onDelete: "cascade" }),
  status: grammarStatus().notNull().default("not_started"),
  notes: text().notNull().default(""),
  links: jsonb().$type<{ title: string; url: string }[]>().notNull().default([]),
  updatedAt: updatedAt(),
});

/** Your own example sentences. They never become answer keys until marked checked. */
export const userSentences = pgTable(
  "user_sentences",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    itemId: integer()
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    ja: text().notNull(),
    en: text().notNull().default(""),
    checked: boolean().notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.itemId)],
);

export const immersionEntries = pgTable(
  "immersion_entries",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    studyDate: day().notNull(),
    kind: immersionKind().notNull(),
    title: text().notNull().default(""),
    minutes: smallint().notNull(),
    subtitles: subtitles().notNull().default("none"),
    notes: text().notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.studyDate)],
);

export const immersionWords = pgTable(
  "immersion_words",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    entryId: integer()
      .notNull()
      .references(() => immersionEntries.id, { onDelete: "cascade" }),
    term: text().notNull(),
    reading: text(),
    meaning: text().notNull().default(""),
    sentence: text(),
    /** Set once the word is sent to flashcards. */
    itemId: integer().references(() => items.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.entryId)],
);

/** Minutes by kind and skill, logged by hand or by the app. */
export const activityLogs = pgTable(
  "activity_logs",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    studyDate: day().notNull(),
    kind: activityKind().notNull(),
    skill: activitySkill().notNull(),
    minutes: smallint().notNull(),
    /** Logged by an in-app session rather than typed in. */
    auto: boolean().notNull().default(false),
    note: text().notNull().default(""),
    immersionEntryId: integer().references(() => immersionEntries.id, { onDelete: "cascade" }),
    classLogId: integer().references(() => classLogs.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.studyDate), check("activity_logs_minutes", sql`${t.minutes} > 0`)],
);

// ---------------------------------------------------------------------------
// Reference content

export const resources = pgTable("resources", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  seedSlug: text().unique(),
  title: text().notNull(),
  url: text().notNull(),
  skill: resourceSkill().notNull(),
  levels: levelOrWork().array().notNull(),
  free: boolean().notNull(),
  notes: text().notNull().default(""),
  favourite: boolean().notNull().default(false),
  hidden: boolean().notNull().default(false),
  /** Removed by you. Kept as a row so the seed doesn't add it back. */
  removedAt: at(),
  source: resourceSource().notNull(),
  seedHash: text(),
  userEditedAt: at(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Speaking prompts with a model answer to compare against. */
export const prompts = pgTable("prompts", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  seedSlug: text().unique(),
  level: levelOrWork().notNull(),
  prompt: text().notNull(),
  hints: text().array().notNull().default(sql`'{}'`),
  model: text().notNull(),
  modelEn: text().notNull(),
  seedHash: text(),
  userEditedAt: at(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** JMdict common words, read-only, for auto-fill. */
export const dictionary = pgTable(
  "dictionary",
  {
    /** The JMdict sequence number. */
    id: text().primaryKey(),
    kanji: text().array().notNull(),
    kana: text().array().notNull(),
    meanings: text().array().notNull(),
    pos: text().array().notNull(),
  },
  (t) => [index().using("gin", t.kanji), index().using("gin", t.kana)],
);

/** Every jōyō kanji, read-only, for auto-fill. */
export const kanjiInfo = pgTable("kanji_info", {
  kanji: text().primaryKey(),
  meanings: text().array().notNull(),
  on: text().array().notNull(),
  kun: text().array().notNull(),
  strokes: smallint().notNull(),
  grade: smallint(),
  jlpt: jlptLevel(),
});

// ---------------------------------------------------------------------------
// Settings and the day's plan

/** One row (id 1) holding src/lib/settings/schema.ts. */
export const settings = pgTable(
  "settings",
  {
    id: smallint().primaryKey().default(1),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [check("settings_one_row", sql`${t.id} = 1`)],
);

/** Per-date exceptions: a rest day, no class, an exam day. */
export const calendarOverrides = pgTable("calendar_overrides", {
  date: day().primaryKey(),
  kind: overrideKind().notNull(),
  note: text().notNull().default(""),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** The day's task list, frozen when the day's first page loads, so both devices see the same. */
export const dayPlans = pgTable("day_plans", {
  studyDate: day().primaryKey(),
  plan: jsonb().$type<Record<string, unknown>>().notNull(),
  createdAt: createdAt(),
  rebuiltAt: at(),
});

/** Tasks marked done or skipped by hand. */
export const taskOverrides = pgTable(
  "task_overrides",
  {
    studyDate: day().notNull(),
    taskKey: text().notNull(),
    mark: taskMark().notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.studyDate, t.taskKey] })],
);

// ---------------------------------------------------------------------------
// Sign-in, reminders, flags and the seed

/**
 * One row per signed-in device. The cookie holds a random id; only its SHA-256 is stored,
 * so a copy of the database can't be turned into a cookie.
 */
export const authSessions = pgTable(
  "auth_sessions",
  {
    idHash: text().primaryKey(),
    /** "phone", "laptop" or "device", from the browser at sign-in. */
    device: text().notNull().default("device"),
    createdAt: createdAt(),
    lastSeenAt: createdAt(),
    expiresAt: at().notNull(),
  },
  (t) => [index().on(t.expiresAt)],
);

/** Recent sign-in tries, for the rate limit. Rows older than a day are cleared on sign-in. */
export const signInAttempts = pgTable(
  "sign_in_attempts",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** Who tried: the IP address. */
    key: text().notNull(),
    ok: boolean().notNull(),
    at: createdAt(),
  },
  (t) => [index().on(t.key, t.at), index().on(t.at)],
);

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  endpoint: text().notNull().unique(),
  keys: jsonb().$type<{ p256dh: string; auth: string }>().notNull(),
  device: text().notNull().default("device"),
  createdAt: createdAt(),
  lastSentAt: at(),
});

/** "This reads wrong" notes from the Flag button. */
export const flags = pgTable("flags", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  itemId: integer().references(() => items.id, { onDelete: "cascade" }),
  questionId: integer().references(() => questions.id, { onDelete: "set null" }),
  /** What was on screen, in case the item changes later. */
  target: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  note: text().notNull().default(""),
  status: flagStatus().notNull().default("open"),
  createdAt: createdAt(),
  resolvedAt: at(),
});

/** Each seed run: deploys skip the seed when the content's hash matches the last run. */
export const seedRuns = pgTable("seed_runs", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  contentHash: text().notNull(),
  startedAt: createdAt(),
  finishedAt: at(),
  summary: jsonb().$type<Record<string, unknown>>(),
});
