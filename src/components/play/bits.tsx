"use client";
// design-lint: legacy

/** Small parts the play pages share: the seal, avatars, the podium, places and icons. */
import type { Place } from "@/lib/games/leaderboard";
import { hueStyle, playerHue } from "@/lib/games/catalog";

export const PLAY_ICONS = {
  play: "M8 5.5v13l11-6.5z",
  home: "M4 11l8-7 8 7 M6 9.5V20h12V9.5",
  back: "M15 5l-7 7 7 7",
  close: "M6 6l12 12 M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7.5",
  sound: "M4 9.5h3.5L12 5.5v13l-4.5-4H4z M15.5 9a4 4 0 0 1 0 6",
  clock: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 7.5V12l3 2",
  noSignal: "M2 8.5a15 15 0 0 1 20 0 M5.5 12a10 10 0 0 1 13 0 M9 15.5a5 5 0 0 1 6 0 M12 19h.01 M3 3l18 18",
  signOut: "M15 4h4v16h-4 M10 8l-4 4 4 4 M6 12h10",
  bin: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13",
} as const;

/** A stroked icon in the play pages' weight. */
export function PlayIcon({ d, size = 20, stroke = 1.9, className }: { d: string; size?: number; stroke?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={d} />
    </svg>
  );
}

/** The filled triangle on Play buttons. */
export function PlayTriangle({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={PLAY_ICONS.play} />
    </svg>
  );
}

/** Michi's seal: 道 on the accent, turned a little. */
export function Seal({ size = 36 }: { size?: number }) {
  return (
    <span
      lang="ja"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.58), borderRadius: Math.round(size * 0.3) }}
      className="inline-flex shrink-0 -rotate-5 items-center justify-center bg-accent font-card font-black text-on-accent"
    >
      道
    </span>
  );
}

const isJapanese = (s: string) => /[^\x00-\x7f]/.test(s);

/** A player's initial in their colour (src/lib/games/catalog.ts, playerHue). */
export function Avatar({ name, size = 34, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      lang={isJapanese(name) ? "ja" : undefined}
      style={{ ...hueStyle(playerHue(name)), width: size, height: size, fontSize: Math.round(size * 0.42) }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-hue-tint font-black text-hue ${className}`}
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

export type PodiumState = "ready" | "loading" | "empty" | "stale";

const PLACES = ["1st", "2nd", "3rd"];
const HEIGHT = { sm: [84, 64, 52], lg: [118, 92, 76] } as const;

/**
 * The top 3 on a podium: 2nd, 1st, 3rd from the left, 1st on the accent. Loading shows grey
 * blocks; a board with nobody on it yet shows three dashed "Open" places; `stale` dims it when
 * there's no signal.
 */
export function Podium({ top, size = "sm", state = "ready" }: { top: readonly Place[]; size?: "sm" | "lg"; state?: PodiumState }) {
  const lg = size === "lg";
  const slots = [0, 1, 2].map((i) => (state === "ready" || state === "stale" ? (top[i] ?? null) : null));
  const label = state === "loading" ? "Top 3, loading" : state === "empty" ? "Top 3: no scores yet" : "Top 3";
  return (
    <ol aria-label={label} aria-busy={state === "loading" || undefined} className={`m-0 grid list-none grid-cols-3 items-end gap-2 p-0 ${state === "stale" ? "opacity-50" : ""}`}>
      {slots.map((p, i) => {
        const avatar = lg ? (i === 0 ? 64 : 52) : i === 0 ? 46 : 38;
        const order = ["order-2", "order-1", "order-3"][i];
        const block = state === "loading" ? "bg-surface2" : !p ? "border-2 border-dashed border-ink2/50 text-ink2" : i === 0 ? "bg-accent text-on-accent" : "bg-surface2 text-ink";
        return (
          <li key={i} className={`flex min-w-0 flex-col items-center gap-1.5 ${order}`}>
            {p ? (
              <Avatar name={p.name} size={avatar} />
            ) : (
              <span
                aria-hidden="true"
                style={{ width: avatar, height: avatar }}
                className={`inline-flex items-center justify-center rounded-full font-black text-ink2 ${state === "loading" ? "bg-surface2" : "border-2 border-dashed border-ink2/50"}`}
              >
                {state === "loading" ? "" : "?"}
              </span>
            )}
            <span className={`max-w-full truncate font-bold ${lg ? "text-sm" : "text-[12.5px]"} ${state === "loading" ? "h-[1.2em] w-12 rounded-md bg-surface2" : ""} ${!p ? "text-ink2" : ""}`}>
              {p ? <PlayerName name={p.name} /> : state === "loading" ? "" : "Open"}
              {p?.you && <span className="font-medium text-ink2"> · you</span>}
            </span>
            <span style={{ height: HEIGHT[size][i] }} className={`flex w-full flex-col items-center gap-0.5 rounded-t-[14px] rounded-b-[4px] pt-2 ${block}`}>
              {state !== "loading" && (
                <>
                  <span className={`leading-none font-black ${lg ? "text-2xl" : "text-[19px]"}`}>{p ? p.score : "–"}</span>
                  <span className="text-xs font-bold">{PLACES[i]}</span>
                </>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** A row on a board: place, avatar, name with its line, score. */
export function BoardRowView({ p, unit, dense = false }: { p: Place; unit: string; dense?: boolean }) {
  return (
    <li className={`flex items-center gap-3 rounded-2xl px-3 ${dense ? "min-h-11" : "min-h-[54px]"} ${p.you ? "bg-accent-soft" : ""}`}>
      <span className="w-6 text-[13px] font-black text-ink2 tabular-nums">{p.place}</span>
      <Avatar name={p.name} size={dense ? 30 : 34} />
      <span className="flex min-w-0 flex-auto flex-col">
        <span className="truncate text-[15px] font-bold">
          <PlayerName name={p.name} />
          {p.you && <span className="font-medium text-ink2"> · you</span>}
        </span>
        {!dense && <span className="text-xs text-ink2">{placeLine(p, unit)}</span>}
      </span>
      <span className={`font-black tabular-nums ${dense ? "text-base" : "text-lg"}`}>{p.score}</span>
    </li>
  );
}
