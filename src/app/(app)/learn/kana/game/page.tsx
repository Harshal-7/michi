import type { Metadata } from "next";

import { KanaGame } from "@/components/kana-game/kana-game";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { loadAnswers, loadGameKana, loadGames } from "@/lib/kana-game/data";
import { SCRIPTS } from "@/lib/kana-game/types";

export const metadata: Metadata = { title: "Kana game" };

/**
 * The kana game: Read it (see a kana, type its romaji) or Find it (see and hear the romaji,
 * pick the kana), with best and recent scores, accuracy, speed and the weakest kana. It never
 * changes the review schedule. `?script=katakana` (from a chart page) picks that script.
 */
export default async function KanaGamePage({ searchParams }: PageProps<"/learn/kana/game">) {
  await requireSignedIn();
  const { script } = await searchParams;
  const db = getDb();
  const [settings, kana, readGames, findGames, readAnswers, findAnswers] = await Promise.all([
    getSettings(db),
    loadGameKana(db),
    loadGames(db, "read"),
    loadGames(db, "find"),
    loadAnswers(db, "read"),
    loadAnswers(db, "find"),
  ]);
  return (
    <KanaGame
      kana={kana}
      history={{ read: { games: readGames, answers: readAnswers }, find: { games: findGames, answers: findAnswers } }}
      voice={settings.voice}
      script={SCRIPTS.find((s) => s === script) ?? null}
    />
  );
}
