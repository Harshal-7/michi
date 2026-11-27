import type { Metadata } from "next";
import Link from "next/link";

import { ICONS } from "@/components/shell/nav";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page";
import { GAMES } from "@/lib/games/registry";

export const metadata: Metadata = { title: "Play" };

/**
 * The games hub. TODO(play shell): the games grid from the play-canvas boards; until then the
 * Learn hub's row list.
 */
export default function PlayHub() {
  return (
    <>
      <PageHeader title="Play" sub="Japanese games anyone can play." />
      <nav aria-label="Games" className="flex flex-col rounded-card bg-surface px-3.5 py-1 shadow-card">
        {GAMES.map((g, i) => (
          <Link key={g.slug} href={g.href} className={`flex min-h-[60px] items-center gap-3.5 py-2 no-underline ${i > 0 ? "border-t border-line" : ""}`}>
            <span lang="ja" aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface2 font-card text-xl font-semibold">
              {g.glyph}
            </span>
            <span className="flex min-w-0 flex-auto flex-col gap-px">
              <span className="text-[15px] font-semibold">{g.name}</span>
              <span className="text-[12.5px] text-ink2">{g.note}</span>
            </span>
            <Icon d={ICONS.chevronRight} size={18} stroke={1.8} className="shrink-0 text-ink2" />
          </Link>
        ))}
      </nav>
    </>
  );
}
