"use client";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { useVersionPoll } from "@/components/ui/use-version-poll";
import { useOutbox } from "@/lib/srs/outbox";

/**
 * "A new version is ready · Reload" (RF_States), once a newer deploy is live: compared with
 * /api/version when the tab comes back into view (and every 10 minutes) and with each /api/reviews
 * reply. A banner at the top, never a pop-up. Reloading is safe mid-session: unsent grades wait in
 * the outbox.
 */
export function VersionBanner({ version }: { version: string }) {
  const { serverVersion } = useOutbox();
  const newer = useVersionPoll(version, "/api/version", [serverVersion]);
  if (!newer) return null;
  return (
    <div className="fixed inset-x-3 top-[max(8px,env(safe-area-inset-top))] z-banner mx-auto max-w-130 rounded-btn-lg shadow-raised laptop:top-4">
      <Banner
        kind="version"
        title="A new version is ready"
        action={
          <Button size="sm" onClick={() => window.location.reload()}>
            Reload
          </Button>
        }
      >
        Reload when you like. Nothing you’ve done is lost.
      </Banner>
    </div>
  );
}
