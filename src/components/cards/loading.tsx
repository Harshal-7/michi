"use client";

import { useSyncExternalStore } from "react";

import { SkeletonText } from "@/components/ui/skeleton";

const subscribeNothing = () => () => {};

/** False while rendering on the server and hydrating, true once in the browser. */
export function useInBrowser(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

/** The loading state while a session starts: skeleton lines in a card (RF_States, loading). */
export function SessionLoading() {
  return (
    <div className="rounded-card border-[1.5px] border-line bg-surface px-5 py-4.5">
      <SkeletonText lines={3} label="Loading" />
    </div>
  );
}
