"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { PlayerSummary } from "@/db/play";

import type { PlayerInfo } from "../games/use-player";

/** Sent on `window` when this device's player changes (named, signed in or out, deleted). */
export const PLAYER_EVENT = "michi:player";
export const announcePlayer = () => window.dispatchEvent(new Event(PLAYER_EVENT));

/** What the name sheet is open for: a new name, signing in, or saving a finished game's score. */
export type SheetMode = { kind: "new" | "have" } | { kind: "save"; score: number; place: number | null };

type PlayContext = {
  /** Null while loading (and `loading` is true), or when nobody on this device has a name. */
  player: PlayerInfo | null;
  summary: PlayerSummary | null;
  loading: boolean;
  /** No signal: the games still work, and finished games wait on the device. */
  offline: boolean;
  reload: () => Promise<void>;
  sheet: SheetMode | null;
  openSheet: (mode: SheetMode) => void;
  closeSheet: () => void;
};

const Ctx = createContext<PlayContext | null>(null);

/**
 * Who's playing on this device, fetched once the page is in the browser (the play pages are
 * static), and the name sheet's state. Every page under /play sits inside it.
 */
export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [summary, setSummary] = useState<PlayerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [online, setOnline] = useState(true);
  const [sheet, setSheet] = useState<SheetMode | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/play/me", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { player: PlayerInfo | null; summary?: PlayerSummary | null };
      setPlayer(body.player);
      setSummary(body.summary ?? null);
      setFetchFailed(false);
    } catch {
      setFetchFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the player is fetched once in the browser
    void reload();
    const changed = () => void reload();
    const up = () => {
      setOnline(true);
      void reload();
    };
    const down = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener(PLAYER_EVENT, changed);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener(PLAYER_EVENT, changed);
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [reload]);

  const value = useMemo<PlayContext>(
    () => ({
      player,
      summary,
      loading,
      offline: !online || fetchFailed,
      reload,
      sheet,
      openSheet: setSheet,
      closeSheet: () => setSheet(null),
    }),
    [player, summary, loading, online, fetchFailed, reload, sheet],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlay(): PlayContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlay() is for pages under /play.");
  return ctx;
}

/** The same, or null outside /play (the games also run in tests without the shell). */
export const usePlayMaybe = () => useContext(Ctx);
