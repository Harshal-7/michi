/** How content records become starter items and which starter deck each one joins. */
import type { Grammar, Kana, Kanji, Level, Word } from "@content/schema";

import type { ItemData, ItemKind } from "@/lib/items/data";
import { dedupeKey } from "@/lib/items/dedupe";
import type { Settings } from "@/lib/settings/schema";

import { recordHash } from "./content";

type CardType = "recognition" | "production" | "fill_in";
type DeckLevel = Level;

export type StarterDeck = {
  slug: string;
  name: string;
  kind: ItemKind;
  level: DeckLevel;
  cardTypes: CardType[];
};

const LEVEL_DECKS = (level: DeckLevel): StarterDeck[] => [
  { slug: `${level.toLowerCase()}-kanji`, name: `${level} kanji`, kind: "kanji", level, cardTypes: ["recognition"] },
  { slug: `${level.toLowerCase()}-words`, name: `${level} words`, kind: "word", level, cardTypes: ["recognition"] },
  { slug: `${level.toLowerCase()}-grammar`, name: `${level} grammar`, kind: "grammar", level, cardTypes: ["fill_in"] },
];

/** In the order the Decks page lists them. */
export const STARTER_DECKS: StarterDeck[] = [
  { slug: "hiragana", name: "Hiragana", kind: "kana", level: "N5", cardTypes: ["recognition"] },
  { slug: "katakana", name: "Katakana", kind: "kana", level: "N5", cardTypes: ["recognition"] },
  ...LEVEL_DECKS("N5"),
  ...LEVEL_DECKS("N4"),
  ...LEVEL_DECKS("N3"),
];

/**
 * N5 decks are on from the start. N4 and N3 lists are preloaded but off until their phase
 * starts (decision 8); the planner may start N3 early (decision 9).
 */
export function deckSwitch(deck: StarterDeck, settings: Settings): { active: boolean; unlockOn: string | null } {
  if (deck.level === "N5") return { active: true, unlockOn: null };
  return { active: false, unlockOn: deck.level === "N4" ? settings.phases.n4.start : settings.phases.n3.start };
}

export type StarterItem = {
  kind: ItemKind;
  level: Level;
  term: string;
  reading: string | null;
  meaning: string;
  data: ItemData;
  dedupeKey: string;
  seedSlug: string;
  seedHash: string;
  /** The deck it joins and the cards it gets. */
  deck: string;
  cardTypes: CardType[];
};

function starter(
  kind: ItemKind,
  record: { slug: string },
  fields: { level: Level; term: string; reading: string | null; meaning: string; data: ItemData },
  deck: string,
): StarterItem {
  const cardTypes = STARTER_DECKS.find((d) => d.slug === deck)!.cardTypes;
  return {
    kind,
    ...fields,
    dedupeKey: dedupeKey(kind, fields.term, fields.reading),
    seedSlug: record.slug,
    seedHash: recordHash(record),
    deck,
    cardTypes,
  };
}

export function kanaItem(r: Kana): StarterItem {
  const { slug: _slug, kana, romaji, ...data } = r;
  return starter("kana", r, { level: "N5", term: kana, reading: romaji, meaning: "", data }, r.script);
}

export function kanjiItem(r: Kanji): StarterItem {
  const { slug: _slug, kanji, level, ...data } = r;
  const reading = [...r.on, ...r.kun].join("、") || null;
  return starter(
    "kanji",
    r,
    { level, term: kanji, reading, meaning: r.meanings.join(", "), data },
    `${level.toLowerCase()}-kanji`,
  );
}

export function wordItem(r: Word): StarterItem {
  const { slug: _slug, level, term, reading, ...data } = r;
  return starter(
    "word",
    r,
    { level, term, reading, meaning: r.meanings.join("; "), data },
    `${level.toLowerCase()}-words`,
  );
}

export function grammarItem(r: Grammar): StarterItem {
  const { slug: _slug, level, pattern, meaning, ...data } = r;
  const item = starter(
    "grammar",
    r,
    { level, term: pattern, reading: null, meaning, data },
    `${level.toLowerCase()}-grammar`,
  );
  // A fill-in card needs a sentence. Points without examples yet (the N4 and N3 lists start
  // as titles and links) get their card when examples arrive, or from your own sentences.
  return r.examples.length > 0 ? item : { ...item, cardTypes: [] };
}
