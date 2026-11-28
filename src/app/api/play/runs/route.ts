import { revalidateTag } from "next/cache";

import { getDb } from "@/db/play";
import { boardTag } from "@/lib/games/leaderboard";
import { saveRun } from "@/lib/games/save";
import { currentPlayer } from "@/lib/play/player";

/**
 * Saves a finished run from a device's queue (src/components/games/queue.ts) for whoever is
 * playing. A fixed address rather than a Server Action, so a run kept on a device across a deploy
 * still saves. A ranked save clears that game's cached boards.
 */
export async function POST(request: Request) {
  const player = await currentPlayer();
  if (!player) return Response.json({ error: "Pick a name first." }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400 });
  }
  const result = await saveRun(getDb(), player, body);
  if (!result.ok) return Response.json(result, { status: 422 });
  const game = (body as { game?: unknown }).game;
  if (result.saved && result.ranked && typeof game === "string") revalidateTag(boardTag(game), { expire: 0 });
  return Response.json(result);
}
