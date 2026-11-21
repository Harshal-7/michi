"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/icon";

import { MAIN_NAV, navKeyFor } from "./nav";

/** The floating pill bar at the bottom of the phone (F_Nav). Hidden from 1024px. */
export function PhoneNav() {
  const current = navKeyFor(usePathname());
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-3.5 pb-[max(14px,env(safe-area-inset-bottom))] laptop:hidden">
      <nav
        aria-label="Main"
        className="pointer-events-auto mx-auto flex max-w-[480px] justify-between rounded-full border border-line bg-surface p-1.5 shadow-nav"
      >
        {MAIN_NAV.map((n) => {
          const on = n.key === current;
          return (
            <Link
              key={n.key}
              href={n.href}
              aria-current={on ? "page" : undefined}
              className={`flex min-h-12 min-w-[60px] flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1 text-[11px] no-underline ${
                on ? "bg-accent-soft font-bold text-accent" : "font-medium text-ink2"
              }`}
            >
              <Icon d={n.icon} />
              <span>{n.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
