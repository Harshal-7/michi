// design-lint: legacy
import type { Metadata } from "next";
import Link from "next/link";

import { PLAY_ICONS, PlayTriangle } from "@/components/play/bits";
import { BestChip, HeroTop, HubHeader, OwnerSignIn, TopThree } from "@/components/play/hub";
import { CATALOG, type CatalogGame, hueStyle, isLive } from "@/lib/games/catalog";

export const metadata: Metadata = { title: "Play" };

/**
 * The games hub (P_Hub, P_HubWeb): quick play, every game as a poster in its colour, and this
 * week's top 3. Static; the greeting, best scores and the board come from the browser.
 */
export default function PlayHub() {
  const more = CATALOG.filter((g) => g.slug !== "kana");
  return (
    <>
      <HubHeader />
      <div className="grid gap-[18px] laptop:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] laptop:gap-5">
        <QuickPlay />
        <div className="hidden laptop:flex laptop:flex-col [&>section]:flex-auto">
          <TopThree />
        </div>
      </div>
      <div className="flex items-baseline justify-between">
        <h2 className="m-0 text-xl font-black laptop:text-[22px]">More games</h2>
        <Link href="/play/leaderboards" className="inline-flex min-h-11 items-center text-sm font-bold text-accent no-underline laptop:hidden">
          Leaderboards
        </Link>
      </div>
      <div className="-mt-1.5 grid grid-cols-2 gap-3 laptop:grid-cols-3 laptop:gap-4">
        {more.map((g) => (
          <GamePoster key={g.slug} game={g} />
        ))}
      </div>
      <div className="laptop:hidden">
        <TopThree />
      </div>
      <OwnerSignIn />
    </>
  );
}

function QuickPlay() {
  return (
    <section
      aria-label="Quick play"
      className="relative flex min-h-[220px] flex-col gap-2 overflow-hidden rounded-game bg-accent p-5 text-on-accent shadow-lift laptop:min-h-[300px] laptop:gap-2.5 laptop:p-8"
    >
      <span lang="ja" aria-hidden="true" className="absolute -right-[18px] -bottom-[58px] font-card text-[230px] leading-none font-black opacity-15 laptop:right-6 laptop:-bottom-[70px] laptop:text-[340px]">
        か
      </span>
      <span className="self-start rounded-full border-[1.5px] border-current px-2.5 py-1 text-[11.5px] font-black tracking-[0.08em] uppercase laptop:text-xs">Quick play</span>
      <h2 className="mt-0.5 mb-0 text-[30px] leading-[1.1] font-black laptop:text-[44px]">Kana game</h2>
      <p className="m-0 max-w-[230px] text-[14.5px] leading-[1.45] laptop:max-w-[380px] laptop:text-[17px]">All 46 hiragana. See one, type how it sounds. About two minutes.</p>
      <div className="relative mt-auto flex items-center gap-3 laptop:gap-4">
        <Link
          href="/play/kana?quick=1"
          className="inline-flex min-h-[52px] items-center gap-2 rounded-btn bg-on-accent pr-[26px] pl-5 text-[17px] font-black text-accent no-underline laptop:min-h-14 laptop:text-lg"
        >
          <PlayTriangle />
          Play
        </Link>
        <HeroTop />
      </div>
    </section>
  );
}

function GamePoster({ game }: { game: CatalogGame }) {
  const live = isLive(game.slug);
  const body = (
    <>
      <span lang="ja" aria-hidden="true" className="absolute -right-2.5 -bottom-[22px] font-card text-[120px] leading-none font-black text-hue opacity-20 laptop:right-1 laptop:-bottom-[30px] laptop:text-[170px]">
        {game.glyph}
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs font-black text-hue laptop:text-[13px]">
        {live ? `${game.minutes} min` : "Soon"}
        {game.sound && (
          <>
            {" · "}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="sound on">
              <path d={PLAY_ICONS.sound} />
            </svg>
          </>
        )}
      </span>
      <span className="text-[17px] leading-[1.15] font-black laptop:text-[22px]">{game.name}</span>
      <span className="relative text-[12.5px] leading-[1.4] text-ink2 laptop:max-w-[240px] laptop:text-sm">
        {game.note}
        {game.ja && (
          <span lang="ja" className="whitespace-nowrap">
            {game.ja}
          </span>
        )}
      </span>
      {live && <BestChip game={game.slug} />}
    </>
  );
  const box = "relative flex min-h-[176px] flex-col gap-1.5 overflow-hidden rounded-[22px] bg-hue-tint p-3.5 text-ink no-underline laptop:min-h-[200px] laptop:rounded-game laptop:p-5";
  return live ? (
    <Link href={`/play/${game.slug}`} style={hueStyle(game.slug)} className={box}>
      {body}
    </Link>
  ) : (
    <div role="group" style={hueStyle(game.slug)} aria-label={`${game.name}: coming soon`} className={`${box} opacity-80`}>
      {body}
    </div>
  );
}
