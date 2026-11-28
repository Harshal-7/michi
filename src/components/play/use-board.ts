"use client";

import { useCallback, useEffect, useState } from "react";

import type { BoardView, Period } from "@/lib/games/leaderboard";

export type BoardStatus = "loading" | "ready" | "error";

/** Boards seen in this tab, so going back to one shows it at once while it's fetched again. */
const seen = new Map<string, BoardView>();

/**
 * One leaderboard (`/api/play/leaderboard`): its top 20 and your place. `setup` null means the
 * setup has no board (it isn't one of the standard ones), so nothing is fetched.
 */
export function useBoard(game: string, setup: string | null, period: Period) {
  const key = setup ? `${game}|${setup}|${period}` : null;
  const [view, setView] = useState<BoardView | null>(() => (key ? (seen.get(key) ?? null) : null));
  const [status, setStatus] = useState<BoardStatus>("loading");

  const load = useCallback(async () => {
    if (!key || !setup) return;
    setStatus("loading");
    setView(seen.get(key) ?? null);
    try {
      const params = new URLSearchParams({ game, setup, period });
      const res = await fetch(`/api/play/leaderboard?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as BoardView;
      seen.set(key, body);
      setView(body);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [key, game, setup, period]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a board is fetched in the browser
    void load();
  }, [load]);

  return { view, status, reload: load };
}
