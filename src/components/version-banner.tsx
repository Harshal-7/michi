"use client";

import { useEffect, useState } from "react";

import { useOutbox } from "@/lib/srs/outbox";

const CHECK_EVERY_MS = 10 * 60_000;

/**
 * "A new version of Michi is ready. Reload" (F_Parts), once a newer deploy is live. The page
 * remembers the deploy it was loaded from, and compares it with /api/version when the tab comes
 * back into view (and every 10 minutes) and with each /api/reviews reply. Reloading is safe
 * mid-session: unsent grades wait in the outbox.
 */
export function VersionBanner({ version }: { version: string }) {
  // The deploy this page's code came from; later renders from a newer server don't change it.
  const [loaded] = useState(version);
  const [latest, setLatest] = useState<string | null>(null);
  const { serverVersion } = useOutbox();

  useEffect(() => {
    if (loaded === "dev") return;
    const check = async () => {
      try {
        const response = await fetch("/api/version", { cache: "no-store" });
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
  }, [loaded]);

  const newer = loaded !== "dev" && [latest, serverVersion].some((v) => v && v !== "dev" && v !== loaded);
  if (!newer) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-3 top-[max(8px,env(safe-area-inset-top))] z-[60] mx-auto flex max-w-[520px] items-center gap-2.5 rounded-xl bg-ink py-2 pr-2 pl-3 text-page shadow-card"
    >
      <span className="flex-auto text-[12.5px]">A new version of Michi is ready.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-11 rounded-full bg-page px-3 text-[12.5px] font-bold text-ink"
      >
        Reload
      </button>
    </div>
  );
}
