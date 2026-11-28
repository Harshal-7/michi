"use client";

import { useEffect, useRef } from "react";

/**
 * B's ruled progress bar: a 10px track with the accent fill and a snow tick between items (n − 1 ticks,
 * drawn while there are 40 items or fewer). `strip` is the laptop goal strip: 24 tall on cover-blue.
 *
 * @example <ProgressBar value={7} max={18} label="Card 7 of 18" />
 */
export function ProgressBar({
  value,
  max,
  label,
  ticks = true,
  tone = "accent",
  size = "md",
  className,
}: {
  /** Items done. */
  value: number;
  /** Items in all. */
  max: number;
  /** Read out with the bar ("Card 7 of 18", "1 of 6 tasks done"). */
  label: string;
  /** The ticks between items. */
  ticks?: boolean;
  /** The fill: accent (default), good, or hanamaru for a finished reward strip. */
  tone?: "accent" | "good" | "hanamaru";
  /** md 10 tall · strip 24 tall on cover-blue (laptop goal strip). */
  size?: "md" | "strip";
  className?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const fill = { accent: "bg-accent", good: "bg-good", hanamaru: "bg-hanamaru" }[tone];
  const track = size === "strip" ? "h-6 rounded-box bg-cover-blue" : "h-2.5 rounded-full bg-track";
  const n = ticks && max > 1 && max <= 40 ? max - 1 : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={`relative overflow-hidden ${track} ${className ?? ""}`}
    >
      <div
        className={`h-full ${size === "strip" ? "rounded-box" : "rounded-full"} ${fill} transition-[width] duration-300 ease-calm`}
        style={{ width: `${pct}%` }}
      />
      {n > 0 && (
        <svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 100 10" preserveAspectRatio="none" className="absolute inset-0">
          {Array.from({ length: n }, (_, i) => {
            const x = (((i + 1) / max) * 100).toFixed(1);
            return <path key={i} d={`M${x} 2.5V7.5`} stroke="var(--snow)" strokeOpacity="0.75" strokeWidth="0.9" vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
      )}
    </div>
  );
}

/**
 * The speed bar for timed answers (the quick check's, the kana game's): it fills from the left over
 * `durationMs`, good-coloured, and turns warn once the time is up. It picks up where it should be if
 * it mounts late (from `startedAt`), and freezes when `running` goes false.
 *
 * @example <TimerBar startedAt={shownAt} durationMs={FAST_MS} running={!answered} />
 */
export function TimerBar({
  startedAt,
  durationMs,
  running,
  label,
  className,
}: {
  /** When the clock started (Date.now()). */
  startedAt: number;
  /** How long until it's full. */
  durationMs: number;
  /** False freezes it where it is (answered). */
  running: boolean;
  /** Read out with it; without one it's decoration. */
  label?: string;
  className?: string;
}) {
  const fill = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = fill.current;
    if (!el) return;
    const elapsed = Math.max(0, Date.now() - startedAt);
    const from = Math.min(1, elapsed / durationMs);
    el.dataset.over = elapsed > durationMs ? "true" : "false";
    if (!running || from >= 1) {
      el.style.transform = `scaleX(${from})`;
      return;
    }
    const slide = el.animate([{ transform: `scaleX(${from})` }, { transform: "scaleX(1)" }], {
      duration: durationMs - elapsed,
      easing: "linear",
      fill: "forwards",
    });
    slide.onfinish = () => (el.dataset.over = "true");
    return () => slide.cancel();
  }, [startedAt, durationMs, running]);
  return (
    <div
      aria-hidden={label ? undefined : true}
      role={label ? "timer" : undefined}
      aria-label={label}
      className={`h-2.5 overflow-hidden rounded-full bg-track ${className ?? ""}`}
    >
      <div ref={fill} data-over="false" style={{ transform: "scaleX(0)" }} className="h-full w-full origin-left bg-good data-[over=true]:bg-warn" />
    </div>
  );
}
