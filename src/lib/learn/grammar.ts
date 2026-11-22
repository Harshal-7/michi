/**
 * Grammar in Learn: the list (F_Grammar), a point's lesson (F_GrammarPoint) and the N5
 * read-through (decision 6): read each lesson, then "I know this" or "Learn it".
 *
 * A point counts as read once it has a quick-check verdict, or its card was started some other
 * way (through New items). Its status is what you set (grammar_progress); a point you never set
 * shows "Learning" once its card is started, otherwise "Not started".
 */
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import type { Level } from "@content/schema";
import type { Db, DbOrTx } from "@/db/client";
import { cards, decks, grammarProgress, items, quickCheck } from "@/db/schema";
import { GrammarData } from "@/lib/items/data";
import { saveOps } from "@/lib/srs/save";

export type GrammarStatus = "not_started" | "learning" | "confident";
export const STATUS_LABEL: Record<GrammarStatus, string> = {
  not_started: "Not started",
  learning: "Learning",
  confident: "Confident",
};

/** The level whose lessons make up the read-through. */
export const READ_THROUGH_LEVEL: Level = "N5";

export type PointRow = {
  id: number;
  level: Level;
  pattern: string;
  gloss: string;
  /** For search: the full meaning and the content key's romaji ("te-kudasai"). */
  searchText: string;
  topic: string | null;
  status: GrammarStatus;
  read: boolean;
};

/** "please do …" from the lesson, or the meaning's first clause for points without one yet. */
export function glossOf(gloss: string | undefined, meaning: string): string {
  if (gloss) return gloss;
  const first = meaning.split(/(?<=[.:;])\s/)[0] ?? meaning;
  return first.replace(/[.:;]$/, "");
}

export function statusOf(stored: GrammarStatus | null, cardState: string | null): GrammarStatus {
  if (stored && stored !== "not_started") return stored;
  return cardState && cardState !== "new" ? "learning" : (stored ?? "not_started");
}

const orderKey = sql<number | null>`(${items.data}->>'order')::int`;

/** A level's points in learning order (N5) or list order (N4, N3), with status and read. */
export async function loadPoints(db: DbOrTx, level: Level): Promise<PointRow[]> {
  const rows = await db
    .select({
      id: items.id,
      level: items.level,
      pattern: items.term,
      meaning: items.meaning,
      data: items.data,
      seedSlug: items.seedSlug,
      stored: grammarProgress.status,
      checked: quickCheck.itemId,
      cardState: cards.state,
    })
    .from(items)
    .leftJoin(grammarProgress, eq(grammarProgress.itemId, items.id))
    .leftJoin(quickCheck, eq(quickCheck.itemId, items.id))
    .leftJoin(cards, and(eq(cards.itemId, items.id), eq(cards.cardType, "fill_in")))
    .where(and(eq(items.kind, "grammar"), eq(items.level, level)))
    .orderBy(sql`${orderKey} asc nulls last`, asc(items.id));
  return rows.map((r) => {
    const data = GrammarData.partial().safeParse(r.data);
    const d = data.success ? data.data : {};
    return {
      id: r.id,
      level: r.level ?? level,
      pattern: r.pattern,
      gloss: glossOf(d.gloss, r.meaning),
      searchText: `${r.meaning} ${r.seedSlug?.split(":").at(-1)?.replace(/-/g, " ") ?? ""}`,
      topic: d.topic ?? null,
      status: statusOf(r.stored, r.cardState),
      read: r.checked !== null || (r.cardState !== null && r.cardState !== "new"),
    };
  });
}

/** Counts for the summary card: by status, and how many are read. */
export function pointCounts(points: readonly PointRow[]) {
  const out = { total: points.length, read: 0, not_started: 0, learning: 0, confident: 0 };
  for (const p of points) {
    out[p.status] += 1;
    if (p.read) out.read += 1;
  }
  return out;
}

/** The read-through's next lesson: the first unread point in learning order after `after`, wrapping round. */
export function nextUnread(points: readonly PointRow[], after?: number): PointRow | null {
  const start = after === undefined ? 0 : points.findIndex((p) => p.id === after) + 1;
  const order = [...points.slice(start), ...points.slice(0, start)];
  return order.find((p) => !p.read && p.id !== after) ?? null;
}

export type Lesson = {
  id: number;
  level: Level;
  pattern: string;
  meaning: string;
  gloss: string;
  formation: string | null;
  topic: string | null;
  examples: { ja: string; en: string }[];
  questions: { slug: string; ja: string; en: string; wrong: string[]; explain?: string }[];
  links: { site: "jlptsensei" | "bunpro"; url: string }[];
  confusables: { id: number; pattern: string; gloss: string }[];
  status: GrammarStatus;
  /** The quick-check verdict, once the lesson's been marked. */
  verdict: "known" | "unsure" | "unknown" | null;
  read: boolean;
};

export async function loadLesson(db: DbOrTx, id: number): Promise<Lesson | null> {
  const [row] = await db
    .select({
      id: items.id,
      level: items.level,
      pattern: items.term,
      meaning: items.meaning,
      data: items.data,
      stored: grammarProgress.status,
      verdict: quickCheck.verdict,
      cardState: cards.state,
    })
    .from(items)
    .leftJoin(grammarProgress, eq(grammarProgress.itemId, items.id))
    .leftJoin(quickCheck, eq(quickCheck.itemId, items.id))
    .leftJoin(cards, and(eq(cards.itemId, items.id), eq(cards.cardType, "fill_in")))
    .where(and(eq(items.id, id), eq(items.kind, "grammar")));
  if (!row?.level) return null;
  const parsed = GrammarData.partial().safeParse(row.data);
  const d = parsed.success ? parsed.data : {};
  const slugs = d.confusables ?? [];
  const confusables = slugs.length
    ? await db
        .select({ id: items.id, pattern: items.term, meaning: items.meaning, data: items.data, seedSlug: items.seedSlug })
        .from(items)
        .where(and(eq(items.kind, "grammar"), inArray(items.seedSlug, slugs)))
    : [];
  return {
    id: row.id,
    level: row.level,
    pattern: row.pattern,
    meaning: row.meaning,
    gloss: glossOf(d.gloss, row.meaning),
    formation: d.formation ?? null,
    topic: d.topic ?? null,
    examples: d.examples ?? [],
    questions: d.questions ?? [],
    links: d.links ?? [],
    confusables: slugs
      .map((s) => confusables.find((c) => c.seedSlug === s))
      .filter((c) => c !== undefined)
      .map((c) => {
        const cd = GrammarData.partial().safeParse(c.data);
        return { id: c.id, pattern: c.pattern, gloss: glossOf(cd.success ? cd.data.gloss : undefined, c.meaning) };
      }),
    status: statusOf(row.stored, row.cardState),
    verdict: row.verdict,
    read: row.verdict !== null || (row.cardState !== null && row.cardState !== "new"),
  };
}

export async function setGrammarStatus(db: DbOrTx, itemId: number, status: GrammarStatus): Promise<void> {
  await db
    .insert(grammarProgress)
    .values({ itemId, status })
    .onConflictDoUpdate({ target: grammarProgress.itemId, set: { status, updatedAt: new Date() } });
}

export type MarkInput = {
  /** Made on the device, so pressing twice or a retry saves the verdict once. */
  opId: string;
  itemId: number;
  choice: "known" | "learn";
  /** The lesson's check questions answered: true for right. */
  answers: boolean[];
};

/**
 * The end of a lesson (decision 6's read-through). "I know this" is a known quick-check verdict,
 * so the card starts with a long interval, unless a check question was missed: then it counts as
 * "Learn it", which puts the card first in line for new cards. Returns the status it set and the
 * next lesson not read yet at the same level.
 */
export async function markLessonIn(db: Db, input: MarkInput): Promise<{ status: GrammarStatus; next: number | null } | { error: string }> {
  const [item] = await db.select({ level: items.level, kind: items.kind }).from(items).where(eq(items.id, input.itemId));
  if (!item?.level || item.kind !== "grammar") return { error: "That grammar point isn't there any more." };
  const missed = input.answers.some((a) => !a);
  const [result] = await saveOps(db, [
    {
      kind: "check",
      id: input.opId,
      itemId: input.itemId,
      verdict: input.choice === "known" ? "known" : "unsure",
      verified: input.choice === "known" && input.answers.length > 0 ? !missed : null,
      checkedAt: new Date().toISOString(),
    },
  ]);
  if (!result || (result.status !== "saved" && result.status !== "duplicate")) return { error: "That didn't save. Try again." };
  const status: GrammarStatus = input.choice === "known" && !missed ? "confident" : "learning";
  await setGrammarStatus(db, input.itemId, status);
  const next = nextUnread(await loadPoints(db, item.level), input.itemId);
  return { status, next: next?.id ?? null };
}

/** When each level's grammar deck switches on, for the level tabs' notes. */
export async function grammarDeckSwitches(db: DbOrTx): Promise<Record<string, { active: boolean; unlockOn: string | null }>> {
  const rows = await db
    .select({ slug: decks.slug, active: decks.active, unlockOn: decks.unlockOn })
    .from(decks)
    .where(inArray(decks.slug, ["n5-grammar", "n4-grammar", "n3-grammar"]));
  return Object.fromEntries(rows.map((r) => [r.slug ?? "", { active: r.active, unlockOn: r.unlockOn }]));
}
