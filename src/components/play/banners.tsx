"use client";

import { useEffect, useState } from "react";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { useVersionPoll } from "@/components/ui/use-version-poll";

import { queuedRuns } from "../games/queue";
import { usePlay } from "./player";

/** "No signal. You can still play." under the top bar (RF_States, offline), with the games waiting to save. */
export function OfflineBanner() {
  const { offline } = usePlay();
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the device's queue is read in the browser
    if (offline) setWaiting(queuedRuns().length);
  }, [offline]);
  if (!offline) return null;
  return (
    <Banner kind="offline" title="No signal. You can still play.">
      Every game works offline. Your scores save when you’re back.
      {waiting > 0 && (
        <span className="font-bold text-ink">
          {" "}
          {waiting === 1 ? "1 game" : `${waiting} games`} waiting to save.
        </span>
      )}
    </Banner>
  );
}

/**
 * "A new version of Michi Play is ready. Reload" once a newer deploy is live (useVersionPoll asks
 * /api/play/version when the tab comes back and every 10 minutes). Finished games wait on the
 * device, so reloading loses nothing.
 */
export function PlayVersionBanner({ version }: { version: string }) {
  const newer = useVersionPoll(version, "/api/play/version");
  if (!newer) return null;
  return (
    <div className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-banner mx-auto max-w-130 rounded-btn-lg shadow-raised">
      <Banner
        kind="version"
        title="A new version of Michi Play is ready."
        action={
          <Button size="sm" onClick={() => window.location.reload()}>
            Reload
          </Button>
        }
      />
    </div>
  );
}
