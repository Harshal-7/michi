import { redirect } from "next/navigation";

/** The kana game moved to the public games on 28 Nov 2026; old links and bookmarks land there. */
export default async function KanaGameMoved({ searchParams }: PageProps<"/learn/kana/game">) {
  const { script } = await searchParams;
  redirect(typeof script === "string" && /^(hiragana|katakana)$/.test(script) ? `/play/kana?script=${script}` : "/play/kana");
}
