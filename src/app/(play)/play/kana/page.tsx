import type { Metadata } from "next";

import { KanaGame } from "@/components/games/kana/kana-game";

export const metadata: Metadata = { title: "Kana game" };

/**
 * The kana game: Read it (see a kana, type its romaji) or Find it (see and hear the romaji, pick
 * the kana), with best and recent scores, accuracy, speed and the weakest kana. Open to everyone;
 * it never changes Harshal's review schedule. `?script=katakana` (from a chart page) picks that script.
 */
export default function KanaGamePage() {
  return <KanaGame />;
}
