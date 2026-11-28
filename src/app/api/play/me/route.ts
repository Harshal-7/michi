import { getDb, loadItemAnswers, loadRuns, loadSummary, ownerVoice } from "@/db/play";
import { gameBySlug } from "@/lib/games/registry";
import { currentPlayer } from "@/lib/play/player";

/**
 * Who's playing on this device, and with `?game=kana` their runs and recent answers of that game
 * for the start screen; without a game, a summary (since when, how many runs, the best of each
 * game) for the play shell, the hub and their own page. The game pages are static; only this small call reads the database, so
 * opening a page doesn't wake it. Never cached: it's one player's own.
 */
export async function GET(request: Request) {
  const player = await currentPlayer();
  const headers = { "cache-control": "private, no-store" };
  if (!player) return Response.json({ player: null }, { headers });
  const game = gameBySlug(new URL(request.url).searchParams.get("game") ?? "");
  const db = getDb();
  const [runs, answers, voice, summary] = await Promise.all([
    game ? loadRuns(db, player.id, game.slug) : [],
    game ? loadItemAnswers(db, player.id, game.slug) : [],
    player.isOwner ? ownerVoice(db) : null,
    game ? null : loadSummary(db, player.id),
  ]);
  return Response.json(
    { player: { id: player.id, name: player.name, isOwner: player.isOwner, hidden: player.hidden }, runs, answers, voice, summary },
    { headers },
  );
}
