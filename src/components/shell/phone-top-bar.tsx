"use client";

import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

import { HUBS } from "./nav";

/**
 * "+ Add a word" at the top right of the phone hubs (Today, Review, Learn, Practice, More), level with
 * the page title (RF_Today, RF_More). It appears once: the laptop sidebar has its own at the bottom.
 */
export function PhoneTopBar() {
  const path = usePathname();
  if (!HUBS.includes(path)) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-nav mx-auto flex max-w-180 justify-end px-5 pt-[max(12px,env(safe-area-inset-top))] laptop:hidden">
      <Button variant="secondary" icon="plus" href="/add-word" className="pointer-events-auto">
        Add a word
      </Button>
    </div>
  );
}
