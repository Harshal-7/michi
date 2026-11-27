import { cachedBoard } from "@/lib/games/boards";
import { boardSince, boardView, PERIODS } from "@/lib/games/leaderboard";
import { gameBySlug } from "@/lib/games/registry";
import { currentPlayer } from "@/lib/play/player";

/**
 * One board: `?game=kana&setup=read:hiragana:basic:20&period=week|all`. The rows are cached
 * (src/lib/games/boards.ts); only "your place" depends on who asks.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const game = gameBySlug(params.get("game") ?? "");
  const setup = game?.setups.find((s) => s.key === params.get("setup"));
  const period = PERIODS.find((p) => p === params.get("period")) ?? "week";
  if (!game || !setup) return Response.json({ error: "No such board." }, { status: 404 });
  const [rows, player] = await Promise.all([cachedBoard(game.slug, setup.key, boardSince(period)), currentPlayer()]);
  return Response.json(boardView(rows, player?.id ?? null), { headers: { "cache-control": "private, no-store" } });
}
