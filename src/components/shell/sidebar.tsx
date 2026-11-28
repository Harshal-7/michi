"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Rabbit } from "@/components/ui/art/rabbit";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

import { Logo } from "./logo";
import { MAIN_NAV, MORE_NAV, navKeyFor } from "./nav";

/**
 * The laptop sidebar (RF_Parts, RF_TodayWeb), from 1024px: the mark, Today · Review · Learn · Practice
 * (the current one a cover-blue tab running into the content edge), More's pages as a quieter group,
 * then the reading rabbit and "+ Add a word" at the bottom.
 */
export function Sidebar({ workBadge }: { /** "opens 1 Jan" while Work Japanese is locked, else null. */ workBadge: string | null }) {
  const current = navKeyFor(usePathname());
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto border-r-[1.5px] border-line bg-page py-5.5 pl-4 laptop:flex">
      <div className="px-2">
        <Logo />
      </div>
      <nav aria-label="Main" className="mt-6 flex flex-col">
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {MAIN_NAV.filter((n) => n.key !== "more").map((n) => {
            const on = n.key === current;
            return (
              <li key={n.key}>
                <Link
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex h-12 items-center gap-3.5 px-4 text-body leading-none no-underline transition-colors duration-120 ${
                    on ? "-mr-0.5 rounded-l-btn bg-cover-blue font-black text-on-cover" : "mr-4 rounded-btn font-bold text-ink hover:bg-surface2"
                  }`}
                >
                  <Icon name={n.icon} size={24} stroke={on ? 2.3 : 2} />
                  <span>{n.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div aria-hidden="true" className="mx-4 mt-4 mb-2.5 h-[1.5px] bg-line" />
        <ul aria-label="More" className="m-0 flex list-none flex-col gap-0.5 p-0">
          {MORE_NAV.map((n) => {
            const on = n.key === current;
            const note = n.key === "work" ? workBadge : null;
            return (
              <li key={n.key}>
                <Link
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 py-1.5 pl-4 text-meta leading-none no-underline transition-colors duration-120 ${
                    on ? "-mr-0.5 rounded-l-btn bg-cover-blue pr-4 font-bold text-on-cover" : "mr-4 rounded-btn pr-2 font-medium text-ink2 hover:bg-surface2 hover:text-ink"
                  }`}
                >
                  <Icon name={n.icon} size={20} />
                  <span className="flex flex-col gap-1">
                    <span>{n.label}</span>
                    {note && <span className="text-caption font-bold">{note}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-auto flex flex-col items-center gap-3 pt-6 pr-4">
        <Rabbit pose="reading" size={120} />
        <Button variant="secondary" icon="plus" href="/add-word" full aria-current={current === "add-word" ? "page" : undefined}>
          Add a word
        </Button>
      </div>
    </aside>
  );
}
