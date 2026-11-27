/**
 * Everything the public games (/play) read and write: players, their sessions, game runs and the
 * leaderboards, plus the owner's minutes and voice. It's the only database module that code
 * under src/app/(play), src/app/api/play, src/lib/play, src/lib/games and src/components/games
 * may reach (src/lib/play/guard.test.ts checks), so Harshal's study data stays private.
 */
import { and, desc, eq, gt, gte, lt, sql } from "drizzle-orm";

import { SESSION_TTL_SECONDS } from "@/lib/auth/token";
import type { StudyDate } from "@/lib/day";
import type { VoicePrefs } from "@/lib/voice/voices";

import type { DbOrTx } from "./client";
import { activityLogs, gameAnswers, gameRuns, players, playerSessions } from "./schema";
import { getSettings } from "./settings";

export { getDb } from "./client";

const DAY_MS = 24 * 60 * 60 * 1000;

/** A player as the games see them. */
export type Player = { id: string; name: string; isOwner: boolean; hidden: boolean };

const PLAYER_COLUMNS = { id: players.id, name: players.name, isOwner: players.isOwner, hidden: players.hidden };

// ---------------------------------------------------------------------------
// Players

/** Harshal's row. The migration makes it; this makes it again if it's ever missing. */
export async function ownerPlayer(db: DbOrTx): Promise<Player> {
  const [row] = await db.select(PLAYER_COLUMNS).from(players).where(eq(players.isOwner, true));
  if (row) return row;
  await db.insert(players).values({ name: "Harshal", nameKey: "harshal", isOwner: true }).onConflictDoNothing();
  const [made] = await db.select(PLAYER_COLUMNS).from(players).where(eq(players.isOwner, true));
  return made;
}

/** A guest by name key, with the PIN's hash for signing in. */
export async function findGuest(db: DbOrTx, nameKey: string): Promise<(Player & { pinHash: string }) | null> {
  const [row] = await db
    .select({ ...PLAYER_COLUMNS, pinHash: players.pinHash })
    .from(players)
    .where(and(eq(players.nameKey, nameKey), eq(players.isOwner, false)));
  return row?.pinHash ? { ...row, pinHash: row.pinHash } : null;
}

/** A new guest, or null when the name is taken. */
export async function createGuest(db: DbOrTx, name: string, nameKey: string, pinHash: string): Promise<Player | null> {
  const [row] = await db.insert(players).values({ name, nameKey, pinHash }).onConflictDoNothing().returning(PLAYER_COLUMNS);
  return row ?? null;
}

/** Changes a player's name; false when another player has it. */
export async function renamePlayer(db: DbOrTx, id: string, name: string, nameKey: string): Promise<boolean> {
  const [taken] = await db.select({ id: players.id }).from(players).where(eq(players.nameKey, nameKey));
  if (taken && taken.id !== id) return false;
  await db.update(players).set({ name, nameKey }).where(eq(players.id, id));
  return true;
}

/** Hides or shows a guest's name on the boards; false when there's no guest by that name. */
export async function setGuestHidden(db: DbOrTx, nameKey: string, hidden: boolean): Promise<boolean> {
  const rows = await db
    .update(players)
    .set({ hidden })
    .where(and(eq(players.nameKey, nameKey), eq(players.isOwner, false)))
    .returning({ id: players.id });
  return rows.length > 0;
}

/** A guest's name, sessions and runs, all gone. The owner's row can't be deleted. */
export async function deleteGuest(db: DbOrTx, id: string): Promise<void> {
  await db.delete(players).where(and(eq(players.id, id), eq(players.isOwner, false)));
}

// ---------------------------------------------------------------------------
// Guest sessions (the __Host-michi_player cookie), like auth_sessions

export async function createPlayerSession(db: DbOrTx, idHash: string, playerId: string, now = new Date()): Promise<void> {
  await db.insert(playerSessions).values({
    idHash,
    playerId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_SECONDS * 1000),
  });
  await db.delete(playerSessions).where(lt(playerSessions.expiresAt, now));
}

/** The guest signed in by this session, if it exists and hasn't expired. Marks it seen at most once a day. */
export async function findPlayerSession(db: DbOrTx, idHash: string, now = new Date()): Promise<Player | null> {
  const [row] = await db
    .select({ ...PLAYER_COLUMNS, lastSeenAt: playerSessions.lastSeenAt })
    .from(playerSessions)
    .innerJoin(players, eq(players.id, playerSessions.playerId))
    .where(and(eq(playerSessions.idHash, idHash), gt(playerSessions.expiresAt, now)));
  if (!row) return null;
  if (now.getTime() - row.lastSeenAt.getTime() > DAY_MS) {
    await db.update(playerSessions).set({ lastSeenAt: now }).where(eq(playerSessions.idHash, idHash));
    await db.update(players).set({ lastSeenAt: now }).where(eq(players.id, row.id));
  }
  return { id: row.id, name: row.name, isOwner: row.isOwner, hidden: row.hidden };
}

export async function deletePlayerSession(db: DbOrTx, idHash: string): Promise<void> {
  await db.delete(playerSessions).where(eq(playerSessions.idHash, idHash));
}

// ---------------------------------------------------------------------------
// Runs

export type StoredRun = {
  id: string;
  game: string;
  setup: string;
  ranked: boolean;
  playedAt: Date;
  studyDate: StudyDate;
  cards: number;
  firstTryRight: number;
  score: number;
  bestStreak: number;
  meanMs: number | null;
  durationMs: number;
  answers: { item: string; right: boolean; ms: number; given: string; tries: number }[];
};

/** Minutes for `activity_logs`: owner runs only (decision H). */
export type RunMinutes = { kind: "study" | "listening"; skill: "general" | "listening"; minutes: number; note: string };

/** Saves a run with its answers, and its minutes when given. Saving the same run again does nothing. */
export async function insertRun(db: DbOrTx, playerId: string, run: StoredRun, minutes: RunMinutes | null): Promise<{ saved: boolean }> {
  return db.transaction(async (tx) => {
    const { answers, ...row } = run;
    const inserted = await tx.insert(gameRuns).values({ ...row, playerId }).onConflictDoNothing().returning({ id: gameRuns.id });
    if (inserted.length === 0) return { saved: false };
    await tx.insert(gameAnswers).values(answers.map((a, position) => ({ runId: run.id, position, ...a })));
    if (minutes && minutes.minutes > 0) {
      await tx.insert(activityLogs).values({
        studyDate: run.studyDate,
        kind: minutes.kind,
        skill: minutes.skill,
        minutes: Math.min(minutes.minutes, 600),
        auto: true,
        note: minutes.note,
      });
    }
    return { saved: true };
  });
}

/** A past run, for the start screen's charts. */
export type PastRun = { setup: string; playedAt: string; score: number; cards: number; firstTryRight: number; meanMs: number | null };
/** One first answer, for the weakest items. `mode` is the setup's first part (kana: read or find). */
export type ItemAnswer = { mode: string; item: string; right: boolean; ms: number };

/** A player's last `perMode` runs of a game in each mode (the setup's first part), newest first. */
export async function loadRuns(db: DbOrTx, playerId: string, game: string, perMode = 40): Promise<PastRun[]> {
  const result = await db.execute<{ setup: string; played_at: Date | string; score: number; cards: number; first_try_right: number; mean_ms: number | null }>(sql`
    select setup, played_at, score, cards, first_try_right, mean_ms from (
      select r.*, row_number() over (partition by split_part(r.setup, ':', 1) order by r.played_at desc) as n
      from ${gameRuns} r
      where r.player_id = ${playerId} and r.game = ${game}
    ) recent
    where n <= ${perMode}
    order by played_at desc`);
  return result.rows.map((r) => ({
    setup: r.setup,
    playedAt: new Date(r.played_at).toISOString(),
    score: r.score,
    cards: r.cards,
    firstTryRight: r.first_try_right,
    meanMs: r.mean_ms,
  }));
}

/** Each item's last `perItem` first answers in each mode, newest first. */
export async function loadItemAnswers(db: DbOrTx, playerId: string, game: string, perItem = 10): Promise<ItemAnswer[]> {
  const result = await db.execute<{ mode: string; item: string; right: boolean; ms: number }>(sql`
    select mode, item, "right", ms from (
      select split_part(r.setup, ':', 1) as mode, a.item, a."right", a.ms, r.played_at,
        row_number() over (partition by split_part(r.setup, ':', 1), a.item order by r.played_at desc) as n
      from ${gameAnswers} a join ${gameRuns} r on r.id = a.run_id
      where r.player_id = ${playerId} and r.game = ${game}
    ) recent
    where n <= ${perItem}
    order by played_at desc, item`);
  return result.rows.map((r) => ({ mode: r.mode, item: r.item, right: r.right, ms: r.ms }));
}

// ---------------------------------------------------------------------------
// Leaderboards

/** A player's best ranked run of one setup. */
export type BoardRow = { playerId: string; name: string; isOwner: boolean; score: number; meanMs: number | null; playedAt: string };

/** The most rows a board keeps; places past this aren't shown. */
export const BOARD_LIMIT = 1000;

/**
 * Each visible player's best ranked run of a setup, from `since` (a study date, the week's
 * Monday) or all time: highest score, then the quicker, then the earlier. Best first.
 */
export async function loadBoard(db: DbOrTx, game: string, setup: string, since: StudyDate | null): Promise<BoardRow[]> {
  const rows = await db
    .selectDistinctOn([gameRuns.playerId], {
      playerId: gameRuns.playerId,
      name: players.name,
      isOwner: players.isOwner,
      score: gameRuns.score,
      meanMs: gameRuns.meanMs,
      playedAt: gameRuns.playedAt,
    })
    .from(gameRuns)
    .innerJoin(players, eq(players.id, gameRuns.playerId))
    .where(
      and(
        eq(gameRuns.game, game),
        eq(gameRuns.setup, setup),
        eq(gameRuns.ranked, true),
        eq(players.hidden, false),
        since ? gte(gameRuns.studyDate, since) : undefined,
      ),
    )
    .orderBy(gameRuns.playerId, desc(gameRuns.score), sql`${gameRuns.meanMs} asc nulls last`, gameRuns.playedAt);
  return rows
    .map((r) => ({ ...r, playedAt: r.playedAt.toISOString() }))
    .sort(compareBoardRows)
    .slice(0, BOARD_LIMIT);
}

/** Best first: higher score, then quicker per card, then whoever got there first. */
export function compareBoardRows(a: BoardRow, b: BoardRow): number {
  return b.score - a.score || (a.meanMs ?? Infinity) - (b.meanMs ?? Infinity) || a.playedAt.localeCompare(b.playedAt) || a.playerId.localeCompare(b.playerId);
}

// ---------------------------------------------------------------------------
// The owner's settings the games use

/** The Japanese voice and speed Harshal picked in Settings → Voice. */
export async function ownerVoice(db: DbOrTx): Promise<VoicePrefs> {
  return (await getSettings(db)).voice;
}
