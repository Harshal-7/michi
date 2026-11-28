/** Small parts the play pages share: the seal, avatars, places and board rows (RF_PlayHub, RF_PlayLeaderboard). */
import type { Place } from "@/lib/games/leaderboard";
import { hueStyle, playerHue } from "@/lib/games/catalog";

/** Michi's seal: 道 on a cover-blue disc with a snow rim. */
export function Seal() {
  return (
    <span
      lang="ja"
      aria-hidden="true"
      className="inline-grid size-9 shrink-0 place-items-center rounded-full bg-cover-blue font-ja text-lead leading-none text-on-cover shadow-sticker"
    >
      道
    </span>
  );
}

const isJapanese = (s: string) => /[^\x00-\x7f]/.test(s);

/** A player's initial in their colour (src/lib/games/catalog.ts, playerHue): 32 on the tint in pills, 88 on the deep shade on their page. */
export function Avatar({ name, size = "sm", className = "" }: { name: string; size?: "sm" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden="true"
      lang={isJapanese(name) ? "ja" : undefined}
      style={hueStyle(playerHue(name))}
      className={`inline-grid shrink-0 place-items-center rounded-full leading-none font-black ${
        size === "lg" ? "size-22 bg-hue text-display text-hue-tint shadow-sticker" : "size-8 bg-hue-tint text-meta text-hue"
      } ${className}`}
    >
      {[...name][0]?.toUpperCase()}
    </span>
  );
}

/** A name, marked as Japanese when it is. */
export function PlayerName({ name, className }: { name: string; className?: string }) {
  return (
    <span lang={isJapanese(name) ? "ja" : undefined} className={className}>
      {name}
    </span>
  );
}

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** "19 of 20 · 1.6 s a kana" under a name on a board. */
export const placeLine = (p: Place, unit: string) =>
  `${p.firstTryRight} of ${p.cards}${p.meanMs === null ? "" : ` · ${(p.meanMs / 1000).toFixed(1)} s a ${unit}`}`;

/** How a board looks while it loads, with nobody on it, or with no signal (dimmed). */
export type BoardState = "ready" | "loading" | "empty" | "stale";

const MEDAL = ["bg-cover-butter", "bg-cover-blue", "bg-cover-mint"];

/** The place: a cover-coloured sticker for the top 3 (butter, blue, mint), a plain number after. */
export function PlaceBadge({ place }: { place: number }) {
  const medal = MEDAL[place - 1];
  return medal ? (
    <span className={`inline-grid size-8 shrink-0 place-items-center rounded-full text-meta leading-none font-black text-on-cover tabular-nums shadow-sticker ${medal}`}>{place}</span>
  ) : (
    <span className="inline-grid w-8 shrink-0 place-items-center text-meta font-bold text-ink2 tabular-nums">{place}</span>
  );
}

/** A row on a board: the place, the name (with its line unless `dense`), the score; yours on accent-soft. */
export function BoardRowView({ p, unit, dense = false }: { p: Place; unit: string; dense?: boolean }) {
  return (
    <li className={`flex items-center gap-3 rounded-btn pr-3.5 pl-2 ${dense ? "min-h-11" : "min-h-13.5"} ${p.you ? "bg-accent-soft" : ""}`}>
      <PlaceBadge place={p.place} />
      <span className="flex min-w-0 flex-auto flex-col">
        <span className="truncate text-body font-bold">
          <PlayerName name={p.name} />
          {p.you && <span className="font-medium text-ink2"> · you</span>}
        </span>
        {!dense && <span className="text-caption text-ink2">{placeLine(p, unit)}</span>}
      </span>
      <span className={`font-black tabular-nums ${dense ? "text-lead" : "text-title"}`}>{p.score}</span>
    </li>
  );
}

/** Grey rows in the shape of a board, while it loads. */
export function BoardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading the board" className="flex flex-col gap-0.5">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="flex min-h-11 items-center gap-3 pr-3.5 pl-2">
          <span className="size-8 shrink-0 animate-pulse-soft rounded-full bg-surface2" />
          <span className="h-3 w-2/5 animate-pulse-soft rounded-full bg-surface2" />
          <span className="ml-auto h-3 w-7 animate-pulse-soft rounded-full bg-surface2" />
        </span>
      ))}
    </div>
  );
}

/** A board's places as a list: the top 3 on the hub and the done screen, the top 20 on the leaderboards. */
export function BoardRows({
  places,
  unit,
  dense = false,
  state = "ready",
  label,
}: {
  places: readonly Place[];
  unit: string;
  dense?: boolean;
  state?: BoardState;
  label: string;
}) {
  if (state === "loading") return <BoardSkeleton rows={dense ? 3 : 6} />;
  return (
    <ol aria-label={label} className={`m-0 flex list-none flex-col gap-0.5 p-0 ${state === "stale" ? "opacity-50" : ""}`}>
      {places.map((p) => (
        <BoardRowView key={`${p.place}-${p.name}`} p={p} unit={unit} dense={dense} />
      ))}
    </ol>
  );
}

/** A key on the keyboard, for the "Enter starts" hints. */
export function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6.5 items-center rounded-box border-[1.5px] border-line-strong bg-surface px-2 font-ui text-caption leading-none font-bold text-ink shadow-btn">
      {children}
    </kbd>
  );
}

/**
 * A game's glyph drawn big (the hero's seal, the tiles): SVG text, so it scales with `size` the way
 * the board draws it, in the pencil hand. Decoration; the game's name says it in words.
 */
export function GameGlyph({ glyph, size, className }: { glyph: string; size: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 100 100" className={`block shrink-0 overflow-visible ${className ?? ""}`}>
      <text x="50" y="52" textAnchor="middle" dominantBaseline="central" fontSize={glyph.length > 1 ? 56 : 78} fill="currentColor" lang="ja" className="font-ja">
        {glyph}
      </text>
    </svg>
  );
}

/** Faint ruled lines across a cobalt band (the hub's hero, a game's start), like the inside of a notebook cover. */
export function PaperRules({ height }: { height: number }) {
  return (
    <svg aria-hidden="true" width="100%" height={height} className="absolute inset-x-0 top-0 text-on-cobalt">
      {Array.from({ length: Math.floor(height / 52) }, (_, i) => (
        <path key={i} d={`M0 ${52 * (i + 1)}H4000`} stroke="currentColor" strokeOpacity="0.07" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

/** Each game's glyph colour on its tile: the cover's deeper tone (RF_PlayHub), as static classes for Tailwind. */
const GAME_TONE: Record<string, string> = {
  kana: "text-tone-cobalt",
  vocab: "text-tone-peri",
  forms: "text-tone-mint",
  particles: "text-tone-lilac",
  numbers: "text-tone-butter",
  sounds: "text-tone-aqua",
  listen: "text-tone-pink",
};

/** The text class for a game's big glyph on its own colour; unknown games use their hue. */
export const gameTone = (slug: string) => GAME_TONE[slug] ?? "text-hue";
