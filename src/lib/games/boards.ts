import "server-only";

import { unstable_cache } from "next/cache";

import { type BoardRow, getDb, loadBoard } from "@/db/play";
import type { StudyDate } from "@/lib/day";

import { BOARD_TAG, boardTag } from "./leaderboard";

/** How long a board is kept before it's read again, when no run has cleared it. */
export const BOARD_SECONDS = 10 * 60;

/**
 * A board's rows, cached so a visit doesn't wake the database: kept for 10 minutes and cleared
 * by a ranked save of that game (/api/play/runs) or a name change. The week's Monday is part of
 * the key, so a new week starts a new board. (`unstable_cache` rather than "use cache": the app
 * doesn't run Cache Components, and turning them on would change every page.)
 */
export function cachedBoard(game: string, setup: string, since: StudyDate | null): Promise<BoardRow[]> {
  return unstable_cache(() => loadBoard(getDb(), game, setup, since), ["play-board", game, setup, since ?? "all"], {
    tags: [BOARD_TAG, boardTag(game)],
    revalidate: BOARD_SECONDS,
  })();
}
