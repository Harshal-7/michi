"use client";

import { useSyncExternalStore } from "react";

const subscribeNothing = () => () => {};

/** False while rendering on the server and hydrating, true once in the browser. */
export function useInBrowser(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

/** The loading state from F_Parts, while a session starts. */
export function SessionLoading() {
  return (
    <div aria-label="Loading" className="flex flex-col gap-2 rounded-card bg-surface p-3">
      <span className="h-3 w-[55%] rounded-full bg-surface2" />
      <span className="h-2.5 w-[85%] rounded-full bg-surface2" />
      <span className="h-2.5 w-[70%] rounded-full bg-surface2" />
    </div>
  );
}
