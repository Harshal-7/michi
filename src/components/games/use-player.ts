"use client";

import { useCallback, useEffect, useState } from "react";

import type { ItemAnswer, PastRun } from "@/db/play";
import type { VoicePrefs } from "@/lib/voice/voices";

export type PlayerInfo = { id: string; name: string; isOwner: boolean; hidden: boolean };

/** What /api/play/me says about this device's player and their runs of one game. */
export type Me = { player: PlayerInfo | null; runs: PastRun[]; answers: ItemAnswer[]; voice: VoicePrefs | null };

const NOBODY: Me = { player: null, runs: [], answers: [], voice: null };

/**
 * Who's playing, fetched once the page is in the browser (the game pages themselves are static).
 * `me` is null while loading; offline it's nobody, and finished runs wait on the device.
 */
export function usePlayer(game: string): { me: Me | null; offline: boolean; reload: () => Promise<void> } {
  const [me, setMe] = useState<Me | null>(null);
  const [offline, setOffline] = useState(false);
  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/play/me?game=${encodeURIComponent(game)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as Partial<Me>;
      setMe({ ...NOBODY, ...body });
      setOffline(false);
    } catch {
      setMe((m) => m ?? NOBODY);
      setOffline(true);
    }
  }, [game]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the player is fetched once in the browser
    void reload();
  }, [reload]);
  return { me, offline, reload };
}
