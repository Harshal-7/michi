"use client";

import { useEffect, useState } from "react";

const CHECK_EVERY_MS = 10 * 60_000;

/**
 * Whether a newer deploy than the one this page came from is live. It remembers the version the page
 * loaded with, and asks `endpoint` (which answers `{ version }`) when the tab comes back into view and
 * every 10 minutes. `seen` adds versions learnt elsewhere (the reviews API's replies). "dev" never
 * counts. Reloading is always safe: unsent grades and games wait on the device.
 *
 * @example const newer = useVersionPoll(appVersion, "/api/version", [serverVersion]);
 */
export function useVersionPoll(version: string, endpoint: string, seen: (string | null | undefined)[] = []): boolean {
  // The deploy this page's code came from; later renders from a newer server don't change it.
  const [loaded] = useState(version);
  const [latest, setLatest] = useState<string | null>(null);

  useEffect(() => {
    if (loaded === "dev") return;
    const check = async () => {
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (response.ok) setLatest(((await response.json()) as { version: string }).version);
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
  }, [loaded, endpoint]);

  return loaded !== "dev" && [latest, ...seen].some((v) => v && v !== "dev" && v !== loaded);
}
