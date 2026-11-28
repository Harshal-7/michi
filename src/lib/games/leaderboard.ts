/**
 * Leaderboards (decision C): for each standard setup, each player's best score this week
 * (Monday to Sunday by study day: IST, from 4 am) and all time, as the top 20 plus your place.
 * The rows come from loadBoard (src/db/play.ts), cached in src/lib/games/boards.ts.
 */
import type { BoardRow } from "@/db/play";
import { type StudyDate, studyDate, weekOf } from "@/lib/day";

/** Every board's cache tag, cleared when a name changes or goes. */
export const BOARD_TAG = "play-board";
/** One game's boards, cleared when a ranked run of it saves. */
export const boardTag = (game: string) => `${BOARD_TAG}:${game}`;

export const PERIODS = ["week", "all"] as const;
export type Period = (typeof PERIODS)[number];

/** How many places a board shows before "your place". */
export const TOP = 20;

/** The first study day a board counts: this week's Monday, or null for all time. */
export const boardSince = (period: Period, now = new Date()): StudyDate | null => (period === "week" ? weekOf(studyDate(now)).start : null);

/** A place on a board, as the page shows it. Player ids stay on the server. */
export type Place = {
  place: number;
  name: string;
  score: number;
  meanMs: number | null;
  playedAt: string;
  cards: number;
  firstTryRight: number;
  isOwner: boolean;
  you: boolean;
};

export type BoardView = { top: Place[]; me: Place | null; players: number };

/** The top places and, when the player is further down, their own. `rows` best first. */
export function boardView(rows: readonly BoardRow[], playerId: string | null, top = TOP): BoardView {
  const places = rows.map(
    (r, i): Place => ({
      place: i + 1,
      name: r.name,
      score: r.score,
      meanMs: r.meanMs,
      playedAt: r.playedAt,
      cards: r.cards,
      firstTryRight: r.firstTryRight,
      isOwner: r.isOwner,
      you: r.playerId === playerId,
    }),
  );
  const mine = places.find((p) => p.you) ?? null;
  return { top: places.slice(0, top), me: mine && mine.place > top ? mine : null, players: places.length };
}

/**
 * Where a score not on the board yet would land: one more than the places that beat it (a higher
 * score, or the same score played quicker). Ties after that go to whoever got there first, so a
 * new run lands after an equal one.
 */
export function placeFor(score: number, meanMs: number | null, rows: readonly Pick<Place, "score" | "meanMs">[]): number {
  const quick = (ms: number | null) => ms ?? Number.POSITIVE_INFINITY;
  return 1 + rows.filter((r) => r.score > score || (r.score === score && quick(r.meanMs) <= quick(meanMs))).length;
}
