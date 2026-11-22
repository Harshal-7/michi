/**
 * What an item keeps in its `data` jsonb, by kind. Starter items take these fields from the
 * content records (content/schema.ts); items you add yourself fill what they have.
 */
import { z } from "zod";

import { Grammar, Kana, Kanji, Word } from "@content/schema";

export const KanaData = Kana.omit({ slug: true, kana: true, romaji: true });
export const KanjiData = Kanji.omit({ slug: true, kanji: true, level: true });
export const WordData = Word.omit({ slug: true, level: true, term: true, reading: true });
export const GrammarData = Grammar.omit({ slug: true, level: true, pattern: true, meaning: true });
/** Work Japanese phrases (round 4). */
export const PhraseData = z.object({ en: z.string().optional(), notes: z.string().optional() });

export const ITEM_DATA = {
  kana: KanaData,
  kanji: KanjiData,
  word: WordData,
  grammar: GrammarData,
  phrase: PhraseData,
} as const;

export type ItemKind = keyof typeof ITEM_DATA;
export type ItemDataFor<K extends ItemKind> = z.infer<(typeof ITEM_DATA)[K]>;
export type ItemData = { [K in ItemKind]: ItemDataFor<K> }[ItemKind] | Record<string, never>;

/** Checks an item's data against its kind. */
export function parseItemData<K extends ItemKind>(kind: K, data: unknown): ItemDataFor<K> {
  return ITEM_DATA[kind].parse(data) as ItemDataFor<K>;
}
