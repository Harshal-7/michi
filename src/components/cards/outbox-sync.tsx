"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { getOutbox, useOutbox } from "@/lib/srs/outbox";

import { WaitingChip } from "./status";

/** Pages that show the outbox's state themselves. */
const SESSION_PAGES = ["/review", "/quick-check"];

/**
 * Sends grades left in the outbox from any page (after a session closed on bad signal), and shows
 * "3 grades waiting to save" outside the session screens until they're saved: just above the phone's
 * bottom bar (--nav-h), bottom right on a laptop.
 */
export function OutboxSync() {
  const state = useOutbox();
  const path = usePathname();
  useEffect(() => {
    void getOutbox().flush();
  }, []);
  if (state.waiting === 0 || SESSION_PAGES.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return (
    <div className="fixed bottom-nav left-5 z-chip flex laptop:right-6 laptop:bottom-6 laptop:left-auto">
      <WaitingChip state={state} />
    </div>
  );
}
