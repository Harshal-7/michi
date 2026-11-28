"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/icon";

import { MAIN_NAV, phoneKeyFor } from "./nav";

/**
 * The phone's bottom bar (RF_Parts): Today · Review · Learn · Practice · More, 72 tall (--nav-h) plus the
 * safe area. The current tab is a 56 × 32 accent-soft pill behind the icon with a bold accent label.
 * Hidden from 1024px, and while a session is on screen (a SessionHeader marks the page data-session).
 */
export function PhoneNav() {
  const current = phoneKeyFor(usePathname());
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-nav grid h-nav grid-cols-5 items-start gap-0.5 border-t-[1.5px] border-line bg-page px-2 pt-1 laptop:hidden [body:has([data-session])_&]:hidden"
    >
      {MAIN_NAV.map((n) => {
        const on = n.key === current;
        return (
          <Link
            key={n.key}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={`flex h-15 min-w-0 flex-col items-center justify-center gap-1 rounded-btn text-caption leading-none no-underline ${
              on ? "font-black text-accent" : "font-bold text-ink2 hover:text-ink"
            }`}
          >
            <span className={`grid h-8 w-14 place-items-center rounded-full transition-colors duration-200 ${on ? "bg-accent-soft" : ""}`}>
              <Icon name={n.icon} size={24} stroke={on ? 2.3 : 2} />
            </span>
            <span>{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
