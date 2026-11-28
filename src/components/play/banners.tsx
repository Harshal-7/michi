"use client";

import { useEffect, useState } from "react";

import { queuedRuns } from "../games/queue";
import { PLAY_ICONS, PlayIcon } from "./bits";
import { usePlay } from "./player";

/** "No signal. You can still play." under the top bar, with the games waiting to save. */
export function OfflineBanner() {
  const { offline } = usePlay();
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the device's queue is read in the browser
    if (offline) setWaiting(queuedRuns().length);
  }, [offline]);
  if (!offline) return null;
  return (
    <div role="status" className="flex items-start gap-3 rounded-[20px] bg-ink px-4 py-3.5 text-page">
      <PlayIcon d={PLAY_ICONS.noSignal} size={24} className="shrink-0" />
      <div className="flex flex-col gap-1.5">
        <p className="m-0 text-[15px] font-black">No signal. You can still play.</p>
        <p className="m-0 text-[13px] leading-[1.45] opacity-85">Every game works offline. Your scores save when you’re back.</p>
        {waiting > 0 && (
          <span className="self-start rounded-full bg-warn px-2.5 py-1 text-xs font-black text-page">
            {waiting === 1 ? "1 game" : `${waiting} games`} waiting to save
          </span>
        )}
      </div>
    </div>
  );
}

const CHECK_EVERY_MS = 10 * 60_000;

/**
 * "A new version of Michi Play is ready. Reload" once a newer deploy is live: the page remembers
 * the deploy it came from and asks /api/play/version when the tab comes back and every 10 minutes.
 * Finished games wait on the device, so reloading loses nothing.
 */
export function PlayVersionBanner({ version }: { version: string }) {
  const [loaded] = useState(version);
  const [latest, setLatest] = useState<string | null>(null);
  useEffect(() => {
    if (loaded === "dev") return;
    const check = async () => {
      try {
        const res = await fetch("/api/play/version", { cache: "no-store" });
        if (res.ok) setLatest(((await res.json()) as { version: string }).version);
      } catch {
        // No signal: check again later.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [loaded]);
  if (loaded === "dev" || !latest || latest === "dev" || latest === loaded) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-[520px] items-center gap-3 rounded-[20px] bg-ink py-2 pr-2 pl-4 text-page shadow-[0_12px_32px_var(--shadow)]"
    >
      <span className="flex-auto text-sm font-bold">A new version of Michi Play is ready.</span>
      <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-btn bg-page px-[18px] text-sm font-black text-ink">
        Reload
      </button>
    </div>
  );
}
