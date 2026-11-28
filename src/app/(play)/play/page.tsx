import type { Metadata } from "next";
import Link from "next/link";

import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { SectionTitle } from "@/components/ui/page-header";
import { Rabbit } from "@/components/ui/art/rabbit";
import { GameGlyph, gameTone, PaperRules } from "@/components/play/bits";
import { BestChip, HeroTop, OwnerSignIn, TopThree } from "@/components/play/hub";
import { CATALOG, type CatalogGame, hueStyle, isLive } from "@/lib/games/catalog";

export const metadata: Metadata = { title: "Play" };

/**
 * The games hub (RF_PlayHub): the kana game as the cobalt quick-play hero, this week's top 3, and every
 * other game as a tile in its cover colour. Static; the player's best and the board come from the browser.
 * On a laptop the hero and the top 3 sit side by side and the tiles fill one row.
 */
export default function PlayHub() {
  const more = CATALOG.filter((g) => g.slug !== "kana");
  return (
    <>
      <h1 className="sr-only">Japanese games</h1>
      <div className="grid gap-4 laptop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] laptop:gap-8">
        <QuickPlay />
        <TopThree />
      </div>
      <section aria-labelledby="more-games" className="flex flex-col gap-1">
        <SectionTitle id="more-games">More games</SectionTitle>
        <ul aria-label="More games" className="m-0 grid list-none grid-cols-3 gap-2.5 p-0 laptop:grid-cols-6 laptop:gap-4">
          {more.map((g) => (
            <GameTile key={g.slug} game={g} />
          ))}
        </ul>
      </section>
      <OwnerSignIn />
    </>
  );
}

function QuickPlay() {
  return (
    <section aria-label="Quick play" className="relative h-66.5 overflow-hidden rounded-l-box rounded-r-card bg-cover-cobalt px-5.5 py-5 text-on-cobalt laptop:h-80 laptop:px-8 laptop:py-7">
      <PaperRules height={320} />
      <Chip cover="butter" className="absolute top-5 right-5 laptop:top-7 laptop:right-8">
        Quick play
      </Chip>
      <span lang="ja" className="absolute top-14 right-7.5 grid size-20 -rotate-8 place-items-center rounded-full bg-snow text-cover-cobalt shadow-raised ring-4 ring-cover-blue laptop:top-18 laptop:right-14 laptop:size-28">
        <GameGlyph glyph="か" size={64} className="laptop:size-22" />
      </span>
      <div className="absolute top-29 right-2.5 laptop:top-40 laptop:right-8">
        <Rabbit pose="cheering" size={100} />
      </div>
      <h2 className="relative m-0 text-display font-black tracking-[-0.01em]">Kana game</h2>
      <p className="relative m-0 mt-2 max-w-47 text-body laptop:max-w-80">All 46 hiragana. See one, type how it sounds. About 2 minutes.</p>
      <div className="absolute inset-x-5.5 bottom-5 flex items-center gap-3.5 laptop:inset-x-8 laptop:bottom-7">
        <Link
          href="/play/kana?quick=1"
          className="inline-flex h-14 w-32 shrink-0 items-center justify-center gap-2.5 rounded-btn-lg bg-cover-butter text-lead leading-none font-bold text-on-cover no-underline shadow-btn active:translate-y-px"
        >
          <Icon name="play" size={22} />
          Play
        </Link>
        <HeroTop />
      </div>
    </section>
  );
}

/** A game as a notebook in its own colour, its glyph big in the corner; the ones still to come say Soon. */
function GameTile({ game }: { game: CatalogGame }) {
  const live = isLive(game.slug);
  const body = (
    <>
      <GameGlyph glyph={game.glyph} size={58} className={`absolute -top-1 right-0 laptop:top-1.5 laptop:right-1.5 laptop:size-20 ${gameTone(game.slug)}`} />
      <span className="absolute top-2 left-2 flex flex-col items-start gap-1">
        <Chip kind="soon">{live ? `${game.minutes} min` : "Soon"}</Chip>
        {live && <BestChip game={game.slug} />}
      </span>
      <span className="absolute inset-x-2.5 bottom-2.25 border-b-[1.5px] border-ink/25 pb-1.25 text-meta leading-tight font-bold text-ink">{game.name}</span>
    </>
  );
  const box = "relative block h-25.5 overflow-hidden rounded-l-box rounded-r-btn-lg bg-hue-tint no-underline laptop:h-36";
  return (
    <li style={hueStyle(game.slug)}>
      {live ? (
        <Link href={`/play/${game.slug}`} className={box}>
          {body}
        </Link>
      ) : (
        <div role="group" aria-label={`${game.name}: coming soon`} className={box}>
          {body}
        </div>
      )}
    </li>
  );
}
