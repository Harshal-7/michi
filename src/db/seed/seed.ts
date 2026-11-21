/**
 * `pnpm db:seed`: puts the starter content into the database.
 *
 * Rules (the plan's "Seeding"):
 * - Rows are matched by their content key (`seed_slug`, or the dictionary id / kanji).
 * - A starter item updates only when its record changed (`seed_hash`) and you haven't edited
 *   it (`user_edited_at` is null).
 * - Cards are only ever added, in state new. Existing cards are never touched.
 * - Nothing is ever deleted.
 * - A record that matches an item already there (same word, added from a class or another
 *   list) is linked to it instead of being added twice.
 * Everything runs in one transaction, so a failed seed changes nothing.
 */
import { desc, inArray, isNotNull, sql } from "drizzle-orm";

import type { Settings } from "@/lib/settings/schema";

import type { Db, Tx } from "../client";
import { cards, deckItems, decks, dictionary, items, kanjiInfo, prompts, resources, seedRuns } from "../schema";
import { getSettings } from "../settings";
import { type Content, recordHash } from "./content";
import { deckSwitch, grammarItem, kanaItem, kanjiItem, STARTER_DECKS, type StarterItem, wordItem } from "./starter";

/** Bump when the seed's mapping changes, so deploys seed again even if the content didn't. */
export const SEED_VERSION = 1;

export type FileSummary = { added: number; updated: number; unchanged: number; keptEdits: number; linked: number };
export type SeedSummary = {
  files: Record<string, FileSummary>;
  decksAdded: number;
  deckItemsAdded: number;
  cardsAdded: number;
};

const CHUNK = 500;
const chunks = <T>(list: T[], size = CHUNK): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

const emptySummary = (): FileSummary => ({ added: 0, updated: 0, unchanged: 0, keptEdits: 0, linked: 0 });

export async function seed(db: Db, content: Content): Promise<SeedSummary> {
  return db.transaction(async (tx) => {
    const settings = await getSettings(tx);
    const summary: SeedSummary = { files: {}, decksAdded: 0, deckItemsAdded: 0, cardsAdded: 0 };

    const deckIds = await seedDecks(tx, settings, summary);
    const starters = starterItems(content);
    const placed = await seedItems(tx, starters, summary);
    await seedDeckItemsAndCards(tx, placed, deckIds, summary);

    summary.files.resources = await seedResources(tx, content.resources);
    summary.files.prompts = await seedPrompts(tx, content.prompts);
    summary.files.dictionary = await seedDictionary(tx, content.dictionary);
    summary.files["kanji-info"] = await seedKanjiInfo(tx, content["kanji-info"]);
    return summary;
  });
}

/** Runs the seed unless the last finished run had the same content and seed version. */
export async function seedIfChanged(
  db: Db,
  content: Content,
  contentHash: string,
): Promise<{ skipped: true } | { skipped: false; summary: SeedSummary }> {
  const hash = `${contentHash}.v${SEED_VERSION}`;
  const [last] = await db
    .select({ contentHash: seedRuns.contentHash })
    .from(seedRuns)
    .where(isNotNull(seedRuns.finishedAt))
    .orderBy(desc(seedRuns.id))
    .limit(1);
  if (last?.contentHash === hash) return { skipped: true };
  const startedAt = new Date();
  const summary = await seed(db, content);
  await db.insert(seedRuns).values({ contentHash: hash, startedAt, finishedAt: new Date(), summary });
  return { skipped: false, summary };
}

// ---------------------------------------------------------------------------

async function seedDecks(tx: Tx, settings: Settings, summary: SeedSummary): Promise<Map<string, number>> {
  const added = await tx
    .insert(decks)
    .values(
      STARTER_DECKS.map((d, position) => ({
        slug: d.slug,
        name: d.name,
        source: "starter" as const,
        kind: d.kind,
        level: d.level,
        cardTypes: d.cardTypes,
        position,
        ...deckSwitch(d, settings),
      })),
    )
    // A deck that exists keeps your settings (on or off, pace, card types).
    .onConflictDoNothing({ target: decks.slug })
    .returning({ id: decks.id });
  summary.decksAdded = added.length;
  const rows = await tx.select({ id: decks.id, slug: decks.slug }).from(decks).where(isNotNull(decks.slug));
  return new Map(rows.map((r) => [r.slug!, r.id]));
}

/** A starter item with its place in its deck. */
type Ranked = StarterItem & { position: number };

function starterItems(content: Content): Ranked[] {
  const all = [
    ...content.kana.map(kanaItem),
    ...content.kanji.map(kanjiItem),
    ...content.words.map(wordItem),
    ...content.grammar.map(grammarItem),
  ];
  // Each item's place in its deck follows the order of its content file.
  const positions = new Map<string, number>();
  return all.map((item) => {
    const position = positions.get(item.deck) ?? 0;
    positions.set(item.deck, position + 1);
    return { ...item, position };
  });
}

const FILE_OF = { kana: "kana", kanji: "kanji", word: "words", grammar: "grammar", phrase: "phrase" } as const;

/** Adds, updates or links each starter item. Returns each record with the item it ended up on. */
async function seedItems(tx: Tx, starters: Ranked[], summary: SeedSummary): Promise<(Ranked & { itemId: number })[]> {
  const existing = await tx
    .select({
      id: items.id,
      kind: items.kind,
      dedupeKey: items.dedupeKey,
      seedSlug: items.seedSlug,
      seedHash: items.seedHash,
      userEditedAt: items.userEditedAt,
    })
    .from(items);
  const bySlug = new Map(existing.filter((e) => e.seedSlug).map((e) => [e.seedSlug!, e]));
  // kind + key → the item (an id, or the slug of an item about to be added) that owns the key.
  const owners = new Map<string, number | string>(existing.map((e) => [`${e.kind}:${e.dedupeKey}`, e.id]));

  const toAdd: Ranked[] = [];
  const toUpdate: (Ranked & { id: number })[] = [];
  const target: (number | string)[] = [];

  for (const s of starters) {
    const file = (summary.files[FILE_OF[s.kind]] ??= emptySummary());
    const key = `${s.kind}:${s.dedupeKey}`;
    const hit = bySlug.get(s.seedSlug);
    if (hit) {
      target.push(hit.id);
      if (hit.seedHash === s.seedHash) file.unchanged++;
      else if (hit.userEditedAt) file.keptEdits++;
      else {
        // Keep the old key if the new one belongs to another item already.
        const owner = owners.get(key);
        const dedupe = owner === undefined || owner === hit.id ? s.dedupeKey : hit.dedupeKey;
        owners.set(`${s.kind}:${dedupe}`, hit.id);
        toUpdate.push({ ...s, dedupeKey: dedupe, id: hit.id });
        file.updated++;
      }
      continue;
    }
    const owner = owners.get(key);
    if (owner !== undefined) {
      target.push(owner);
      file.linked++;
      continue;
    }
    owners.set(key, s.seedSlug);
    target.push(s.seedSlug);
    toAdd.push(s);
    file.added++;
  }

  const added = new Map<string, number>();
  for (const chunk of chunks(toAdd)) {
    const rows = await tx
      .insert(items)
      .values(
        chunk.map((s) => ({
          kind: s.kind,
          level: s.level,
          track: "jlpt" as const,
          term: s.term,
          reading: s.reading,
          meaning: s.meaning,
          source: "starter" as const,
          data: s.data,
          dedupeKey: s.dedupeKey,
          seedSlug: s.seedSlug,
          seedHash: s.seedHash,
        })),
      )
      .returning({ id: items.id, seedSlug: items.seedSlug });
    for (const r of rows) added.set(r.seedSlug!, r.id);
  }

  for (const chunk of chunks(toUpdate)) {
    const values = chunk.map((s) => ({
      id: s.id,
      level: s.level,
      term: s.term,
      reading: s.reading,
      meaning: s.meaning,
      data: s.data,
      dedupe_key: s.dedupeKey,
      seed_hash: s.seedHash,
    }));
    // One statement per chunk. The user_edited_at check is repeated here, in case you edited
    // the item while the seed was running.
    await tx.execute(sql`
      update items set
        level = v.level::jlpt_level, term = v.term, reading = v.reading, meaning = v.meaning,
        data = v.data, dedupe_key = v.dedupe_key, seed_hash = v.seed_hash, updated_at = now()
      from jsonb_to_recordset(${JSON.stringify(values)}::jsonb) as v(
        id integer, level text, term text, reading text, meaning text, data jsonb, dedupe_key text, seed_hash text
      )
      where items.id = v.id and items.user_edited_at is null`);
  }

  return starters.map((s, i) => {
    const t = target[i];
    return { ...s, itemId: typeof t === "number" ? t : added.get(t)! };
  });
}

/** Puts each item in its deck and adds any cards it doesn't have yet. */
async function seedDeckItemsAndCards(
  tx: Tx,
  placed: (Ranked & { itemId: number })[],
  deckIds: Map<string, number>,
  summary: SeedSummary,
) {
  const memberships = placed.map((p) => ({ deckId: deckIds.get(p.deck)!, itemId: p.itemId, position: p.position }));
  for (const chunk of chunks(memberships)) {
    const rows = await tx.insert(deckItems).values(chunk).onConflictDoNothing().returning({ itemId: deckItems.itemId });
    summary.deckItemsAdded += rows.length;
  }

  const wanted = new Map<string, { itemId: number; cardType: StarterItem["cardTypes"][number]; newRank: number }>();
  for (const p of placed) {
    for (const cardType of p.cardTypes) {
      const key = `${p.itemId}:${cardType}`;
      if (!wanted.has(key)) wanted.set(key, { itemId: p.itemId, cardType, newRank: p.position });
    }
  }
  for (const chunk of chunks([...wanted.values()])) {
    const rows = await tx
      .insert(cards)
      .values(chunk)
      .onConflictDoNothing({ target: [cards.itemId, cards.cardType] })
      .returning({ id: cards.id });
    summary.cardsAdded += rows.length;
  }
}

/**
 * Adds or updates rows of a seed_slug table under the same rules as items: update only when
 * the record changed and you haven't edited the row.
 */
async function upsertBySlug<Row extends { seedSlug: string; seedHash: string }>(
  tx: Tx,
  table: typeof resources | typeof prompts,
  rows: Row[],
  updateColumns: string[],
): Promise<FileSummary> {
  const summary = emptySummary();
  const existing = await tx
    .select({ seedSlug: table.seedSlug, seedHash: table.seedHash, userEditedAt: table.userEditedAt })
    .from(table)
    .where(isNotNull(table.seedSlug));
  const bySlug = new Map(existing.map((e) => [e.seedSlug!, e]));
  const changed: Row[] = [];
  for (const row of rows) {
    const hit = bySlug.get(row.seedSlug);
    if (!hit) summary.added++;
    else if (hit.seedHash === row.seedHash) {
      summary.unchanged++;
      continue;
    } else if (hit.userEditedAt) {
      summary.keptEdits++;
      continue;
    } else summary.updated++;
    changed.push(row);
  }
  const set = Object.fromEntries(updateColumns.map((c) => [c, sql.raw(`excluded.${c}`)]));
  for (const chunk of chunks(changed)) {
    await tx
      .insert(table)
      .values(chunk as never)
      .onConflictDoUpdate({
        target: table.seedSlug,
        set: { ...set, updatedAt: new Date() },
        setWhere: sql`${table.userEditedAt} is null`,
      });
  }
  return summary;
}

function seedResources(tx: Tx, records: Content["resources"]) {
  return upsertBySlug(
    tx,
    resources,
    records.map((r) => ({
      seedSlug: r.slug,
      seedHash: recordHash(r),
      title: r.title,
      url: r.url,
      skill: r.skill,
      levels: r.levels,
      free: r.free,
      notes: r.notes,
      source: "starter" as const,
    })),
    ["title", "url", "skill", "levels", "free", "notes", "seed_hash"],
  );
}

function seedPrompts(tx: Tx, records: Content["prompts"]) {
  return upsertBySlug(
    tx,
    prompts,
    records.map((r) => ({
      seedSlug: r.slug,
      seedHash: recordHash(r),
      level: r.level,
      prompt: r.prompt,
      hints: r.hints,
      model: r.model,
      modelEn: r.modelEn,
    })),
    ["level", "prompt", "hints", "model", "model_en", "seed_hash"],
  );
}

const DICTIONARY_CHUNK = 1000;

/**
 * Read-only reference data, loaded in batches. A row is written only when it differs from
 * what's stored, so a second run writes nothing.
 */
async function seedDictionary(tx: Tx, records: Content["dictionary"]): Promise<FileSummary> {
  const summary = emptySummary();
  for (const chunk of chunks(records, DICTIONARY_CHUNK)) {
    const ids = chunk.map((r) => r.id);
    const before = await tx.select({ id: dictionary.id }).from(dictionary).where(inArray(dictionary.id, ids));
    const written = await tx
      .insert(dictionary)
      .values(chunk.map((r) => ({ id: r.id, kanji: r.kanji, kana: r.kana, meanings: r.meanings, pos: r.pos })))
      .onConflictDoUpdate({
        target: dictionary.id,
        set: {
          kanji: sql`excluded.kanji`,
          kana: sql`excluded.kana`,
          meanings: sql`excluded.meanings`,
          pos: sql`excluded.pos`,
        },
        setWhere: sql`(${dictionary.kanji}, ${dictionary.kana}, ${dictionary.meanings}, ${dictionary.pos})
          is distinct from (excluded.kanji, excluded.kana, excluded.meanings, excluded.pos)`,
      })
      .returning({ id: dictionary.id });
    tally(summary, chunk.length, before.length, written.length);
  }
  return summary;
}

async function seedKanjiInfo(tx: Tx, records: Content["kanji-info"]): Promise<FileSummary> {
  const summary = emptySummary();
  for (const chunk of chunks(records, DICTIONARY_CHUNK)) {
    const keys = chunk.map((r) => r.kanji);
    const before = await tx.select({ k: kanjiInfo.kanji }).from(kanjiInfo).where(inArray(kanjiInfo.kanji, keys));
    const written = await tx
      .insert(kanjiInfo)
      .values(chunk)
      .onConflictDoUpdate({
        target: kanjiInfo.kanji,
        set: {
          meanings: sql`excluded.meanings`,
          on: sql`excluded.on`,
          kun: sql`excluded.kun`,
          strokes: sql`excluded.strokes`,
          grade: sql`excluded.grade`,
          jlpt: sql`excluded.jlpt`,
        },
        setWhere: sql`(${kanjiInfo.meanings}, ${kanjiInfo.on}, ${kanjiInfo.kun}, ${kanjiInfo.strokes}, ${kanjiInfo.grade}, ${kanjiInfo.jlpt})
          is distinct from (excluded.meanings, excluded.on, excluded.kun, excluded.strokes, excluded.grade, excluded.jlpt)`,
      })
      .returning({ k: kanjiInfo.kanji });
    tally(summary, chunk.length, before.length, written.length);
  }
  return summary;
}

/** `written` counts both new rows and changed ones; `existed` tells them apart. */
function tally(summary: FileSummary, total: number, existed: number, written: number) {
  const added = total - existed;
  summary.added += added;
  summary.updated += written - added;
  summary.unchanged += total - written;
}
