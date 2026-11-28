import type { ReactNode } from "react";

/**
 * The streak as a round butter sticker with the count, tilted −6°, with "day streak" beside it.
 * 44 on screens, 36 compact.
 *
 * @example <StreakBadge count={6} sub="best yet" />
 */
export function StreakBadge({
  count,
  label = "day streak",
  sub,
  size = "md",
}: {
  /** Days in a row. */
  count: number;
  /** The bold line beside it. */
  label?: ReactNode;
  /** The quiet line under it ("best yet"). */
  sub?: ReactNode;
  /** md 44 · sm 36. */
  size?: "md" | "sm";
}) {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className={`grid -rotate-6 place-items-center rounded-full bg-cover-butter leading-none font-black text-on-cover shadow-sticker ${
          size === "md" ? "size-11 text-title" : "size-9 text-lead"
        }`}
      >
        {count}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-meta font-bold">
          <span className="sr-only">{count} </span>
          {label}
        </span>
        {sub && <span className="text-caption font-medium text-ink2">{sub}</span>}
      </span>
    </div>
  );
}
