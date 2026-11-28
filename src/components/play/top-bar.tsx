"use client";
// design-lint: legacy

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar, PLAY_ICONS, PlayIcon, PlayerName, Seal } from "./bits";
import { usePlay } from "./player";

const LINKS = [
  { href: "/play", label: "Games" },
  { href: "/play/leaderboards", label: "Leaderboards" },
];

/**
 * The top of every /play page, phone and laptop (P_Top, P_TopWeb): the seal and "Michi Play",
 * Games and Leaderboards on a laptop, and the player on the right. Signed out it offers a name;
 * a player's pill goes to their page; Harshal also gets the way back to his Michi.
 */
export function PlayTopBar() {
  const { player, loading, openSheet } = usePlay();
  const path = usePathname();
  const onMe = path === "/play/me";
  return (
    <header className="laptop:border-b laptop:border-line">
      <div className="mx-auto flex max-w-[1200px] items-center gap-6 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-1 laptop:px-10 laptop:py-3.5">
        <Link href="/play" aria-label="Michi Play, all games" className="flex items-center gap-2.5 no-underline">
          <Seal size={36} />
          <span className="text-[19px] font-black tracking-[-0.01em] whitespace-nowrap laptop:text-[21px]">
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
                className={`inline-flex min-h-11 items-center rounded-btn px-4 text-[15px] no-underline ${on ? "bg-surface2 font-bold text-ink" : "font-medium text-ink2"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {loading ? (
            <span aria-label="Loading your name" role="img" className="h-11 w-[132px] rounded-btn bg-surface2" />
          ) : player ? (
            <>
              {player.isOwner && (
                <Link
                  href="/"
                  aria-label="Back to my Michi"
                  className="inline-flex size-11 items-center justify-center gap-2 rounded-btn border border-line bg-surface text-sm font-bold no-underline laptop:w-auto laptop:px-4"
                >
                  <PlayIcon d={PLAY_ICONS.home} size={19} />
                  <span className="hidden laptop:inline">My Michi</span>
                </Link>
              )}
              <Link
                href="/play/me"
                aria-current={onMe ? "page" : undefined}
                className={`inline-flex min-h-11 max-w-[170px] items-center gap-2 rounded-btn bg-surface pr-3.5 pl-[5px] text-sm font-bold no-underline ${onMe ? "border-2 border-ink" : "border border-line"}`}
              >
                <Avatar name={player.name} size={34} />
                <PlayerName name={player.name} className="truncate" />
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={() => openSheet({ kind: "new" })}
              className="min-h-11 rounded-btn bg-ink px-[18px] text-sm font-bold whitespace-nowrap text-page"
            >
              Pick a name
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
