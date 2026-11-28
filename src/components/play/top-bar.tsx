"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/icon";

import { Avatar, PlayerName, Seal } from "./bits";
import { usePlay } from "./player";

const LINKS = [
  { href: "/play", label: "Games" },
  { href: "/play/leaderboards", label: "Leaderboards" },
];

/**
 * The top of every /play page, phone and laptop (RF_PlayHub): the seal and "Michi Play", Games and
 * Leaderboards on a laptop, and the player on the right. Signed out it offers a name; a player's
 * pill goes to their page; Harshal also gets the way back to his Michi.
 */
export function PlayTopBar() {
  const { player, loading, openSheet } = usePlay();
  const path = usePathname();
  const onMe = path === "/play/me";
  return (
    <header className="laptop:border-b laptop:border-line">
      <div className="mx-auto flex max-w-300 items-center gap-6 px-5 pt-[max(12px,env(safe-area-inset-top))] laptop:px-11 laptop:py-3">
        <Link href="/play" aria-label="Michi Play, all games" className="flex h-12 items-center gap-3 no-underline">
          <Seal />
          <span className="text-title leading-none font-black tracking-[-0.01em] whitespace-nowrap">
            Michi <span className="text-accent">Play</span>
          </span>
        </Link>
        <nav aria-label="Play" className="hidden flex-auto gap-1 laptop:flex">
          {LINKS.map((l) => {
            const on = l.href === "/play" ? path === "/play" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={on ? "page" : undefined}
                className={`inline-flex h-11 items-center rounded-pill px-4 text-body no-underline ${on ? "bg-accent-soft font-bold text-accent" : "font-medium text-ink2 hover:text-ink"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {loading ? (
            <span aria-label="Loading your name" role="img" className="h-12 w-33 animate-pulse-soft rounded-btn bg-surface2" />
          ) : player ? (
            <>
              {player.isOwner && (
                <Link
                  href="/"
                  aria-label="Back to my Michi"
                  className="inline-flex size-12 items-center justify-center gap-2 rounded-btn border-[1.5px] border-line-strong text-body font-bold text-ink no-underline hover:bg-surface2 laptop:w-auto laptop:px-4"
                >
                  <Icon name="home" size={22} />
                  <span className="hidden laptop:inline">My Michi</span>
                </Link>
              )}
              <Link
                href="/play/me"
                aria-current={onMe ? "page" : undefined}
                className={`inline-flex h-12 max-w-44 items-center gap-2 rounded-btn border-[1.5px] pr-3.5 pl-2 text-body font-bold text-ink no-underline hover:bg-surface2 ${
                  onMe ? "border-accent bg-accent-soft" : "border-line-strong"
                }`}
              >
                <Avatar name={player.name} />
                <PlayerName name={player.name} className="truncate" />
              </Link>
            </>
          ) : (
            <button type="button" onClick={() => openSheet({ kind: "new" })} className="h-12 rounded-btn bg-ink px-4.5 text-body leading-none font-bold whitespace-nowrap text-page">
              Pick a name
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
