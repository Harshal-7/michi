"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/icon";

import { MAIN_NAV, MORE_NAV, navKeyFor } from "./nav";

/** The laptop sidebar with everything (TodayWeb). Shown from 1024px. */
export function Sidebar({ workBadge }: { workBadge: string | null }) {
  const current = navKeyFor(usePathname());
  return (
    <aside className="sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col gap-[18px] overflow-y-auto border-r border-line px-3.5 py-6 laptop:flex">
      <Link href="/" className="mx-2.5 flex items-baseline gap-2 font-head text-2xl no-underline">
        Michi{" "}
        <span lang="ja" className="text-accent">
          道
        </span>
      </Link>
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {[...MAIN_NAV, ...MORE_NAV].map((n) => {
          const on = n.key === current;
          const locked = n.key === "work" && workBadge !== null;
          return (
            <Link
              key={n.key}
              href={n.href}
              aria-current={on ? "page" : undefined}
              className={`flex min-h-11 items-center gap-2.5 rounded-btn px-2.5 text-sm no-underline ${
                on ? "bg-accent-soft font-bold text-ink" : "font-medium text-ink2"
              } ${locked && !on ? "opacity-85" : ""}`}
            >
              <Icon d={n.icon} size={20} />
              <span className="flex-auto">{n.label}</span>
              {locked && (
                <span className="rounded-full border border-line px-2 py-px text-xs font-bold text-ink2">{workBadge}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <Link
        href="/add-word"
        className="mt-auto flex min-h-11 items-center justify-center gap-1.5 rounded-btn border border-line bg-surface text-sm font-semibold no-underline"
      >
        + Add a word
      </Link>
    </aside>
  );
}
