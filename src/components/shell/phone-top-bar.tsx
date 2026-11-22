"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/icon";

import { ICONS, navKeyFor } from "./nav";

/**
 * The top of every phone page: the name, "+ Add a word" and the way into More.
 * Proposed on the canvas as F_PhoneTop (not on the approved boards yet). Hidden from 1024px.
 */
export function PhoneTopBar() {
  const current = navKeyFor(usePathname());
  const onMore = current === "more";
  const onAdd = current === "add-word";
  return (
    <div className="flex items-center justify-between gap-2 px-4 pt-[max(12px,env(safe-area-inset-top))] laptop:hidden">
      <Link href="/" className="flex items-baseline gap-1.5 font-head text-xl no-underline">
        Michi{" "}
        <span lang="ja" className="text-accent">
          道
        </span>
      </Link>
      <div className="flex items-center gap-2">
        <Link
          href="/add-word"
          aria-current={onAdd ? "page" : undefined}
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-btn border px-3.5 text-sm font-semibold no-underline ${
            onAdd ? "border-transparent bg-accent-soft text-accent" : "border-line bg-surface"
          }`}
        >
          <Icon d={ICONS.plus} size={16} stroke={2} />
          Add a word
        </Link>
        <Link
          href="/more"
          aria-label="More"
          aria-current={onMore ? "page" : undefined}
          className={`inline-flex size-11 items-center justify-center rounded-full border ${
            onMore ? "border-transparent bg-accent-soft text-accent" : "border-line bg-surface2 text-ink"
          }`}
        >
          <Icon d={ICONS.more} size={22} stroke={2.6} />
        </Link>
      </div>
    </div>
  );
}
