import { Sticker, type StickerKind } from "./art/rewards";

const DAYS = ["日", "月", "火", "水", "木", "金", "土"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Each placed sticker's small tilt, by weekday. */
const TILT = [-8, 6, -4, 9, -6, 5, -7];

/**
 * The week as B's 日–土 sticker sheet: a round sticker on each day studied, a dashed circle for the
 * rest, today's day in accent. With `dropping`, today's sticker drops on at 58px (420 ms spring, a
 * dotted trail); under reduced motion it's simply there.
 *
 * @example <StickerSheet days={["star-butter", "flower-pink", null, …]} today={4} dropping />
 */
export function StickerSheet({
  days,
  today,
  dropping = false,
  size = 36,
}: {
  /** Sunday → Saturday: the sticker earned that day, or null. */
  days: (StickerKind | null)[];
  /** Today's index (0 = Sunday), shown in accent. */
  today?: number;
  /** Today's sticker is landing right now. */
  dropping?: boolean;
  /** Sticker size in px. */
  size?: number;
}) {
  const earned = days.filter(Boolean).length;
  return (
    <ol aria-label={`This week’s stickers, Sunday to Saturday: ${earned} of 7 days`} className="m-0 grid list-none grid-cols-7 items-end gap-1.5 p-0">
      {DAYS.map((d, i) => {
        const kind = days[i] ?? null;
        const isToday = i === today;
        return (
          <li key={d} className="flex flex-col items-center gap-1.5" aria-label={`${DAY_NAMES[i]}: ${kind ? "studied" : "no sticker"}`}>
            {kind && isToday && dropping ? (
              <span className="relative block" style={{ width: size, height: size }}>
                <span aria-hidden="true" className="absolute inset-0 rounded-full bg-shade" />
                <span className="absolute -top-10 -left-3 animate-drop">
                  <Sticker kind={kind} size={58} rotate={-12} shadow={false} />
                </span>
              </span>
            ) : kind ? (
              <Sticker kind={kind} size={size} rotate={TILT[i]} />
            ) : (
              <span aria-hidden="true" className="block rounded-full border-2 border-dashed border-line-strong" style={{ width: size, height: size }} />
            )}
            <span lang="ja" className={`font-ja text-meta leading-none ${isToday ? "text-accent" : "text-ink2"}`}>
              {d}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
