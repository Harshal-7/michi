/**
 * The kana the game asks, read from content/generated/kana.json at build time, so the game needs
 * no database to play.
 */
import type { Kana } from "@content/schema";
import kanaJson from "@content/generated/kana.json";

import type { GameKana, Group } from "./types";

export const ALL_KANA: readonly GameKana[] = (kanaJson as Kana[]).map((k) => ({
  key: k.slug,
  kana: k.kana,
  romaji: k.romaji,
  accept: k.accept,
  lookalikes: k.lookalikes,
  script: k.script,
  group: k.group,
}));

/** The kana that match the picked scripts and groups. Extended sounds are katakana only. */
export function kanaFor(all: readonly GameKana[], scripts: readonly GameKana["script"][], groups: readonly Group[]): GameKana[] {
  return all.filter((k) => scripts.includes(k.script) && groups.includes(k.group));
}
