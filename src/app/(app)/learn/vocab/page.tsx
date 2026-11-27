import type { Metadata } from "next";

import { VocabPractice } from "@/components/learn/vocab-practice";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { isLevel } from "@/lib/vocab/types";
import { levelCounts, loadVocab } from "@/lib/vocab/words";

export const metadata: Metadata = { title: "Vocabulary" };

/**
 * Typed vocabulary practice (Learn): a level's JLPT words, Japanese → English or back, all of
 * them, the ones not typed right yet, or the ones missed last time. One level loads at a time
 * (`?level=N4`); the run itself happens in the browser.
 */
export default async function VocabPage({ searchParams }: PageProps<"/learn/vocab">) {
  await requireSignedIn();
  const param = (await searchParams).level;
  const level = isLevel(param) ? param : "N5";
  const db = getDb();
  const [settings, words, counts] = await Promise.all([getSettings(db), loadVocab(db, level), levelCounts(db)]);
  return <VocabPractice key={level} level={level} words={words} counts={counts} furigana={settings.furigana} voice={settings.voice} />;
}
