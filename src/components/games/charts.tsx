"use client";

/**
 * Small charts for the game's start screen, drawn as SVG in the tokens: score per game as bars,
 * accuracy and speed per game as lines. One series each, one axis, a few recessive grid lines,
 * and a tooltip (the SVG title) on every game. They draw at the width they're given, so the
 * text stays the same size on a phone and a laptop.
 */
import { type ReactNode, useEffect, useRef, useState } from "react";

import type { PastGame } from "@/lib/games/progress";

const H = 112;
const PAD = { top: 8, right: 6, bottom: 6, left: 34 };
const plotH = H - PAD.top - PAD.bottom;
/** Slots are drawn for at least this many games, so a few games don't make fat bars. */
const MIN_SLOTS = 10;

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function Frame({
  label,
  ticks,
  children,
}: {
  label: string;
  ticks: { y: number; text: string }[];
  children: (geometry: { width: number }) => ReactNode;
}) {
  const [ref, width] = useWidth();
  return (
    <div ref={ref} className="w-full" style={{ height: H }}>
      {width > 0 && (
        <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={label} className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t.text}>
              <line x1={PAD.left} x2={width - PAD.right} y1={t.y} y2={t.y} className="stroke-line" strokeWidth={1} />
              <text x={PAD.left - 6} y={t.y} dy="0.32em" textAnchor="end" className="fill-ink2 text-caption">
                {t.text}
              </text>
            </g>
          ))}
          {children({ width })}
        </svg>
      )}
    </div>
  );
}

const slotsFor = (games: number, width: number) => Math.max(0, width - PAD.left - PAD.right) / Math.max(games, MIN_SLOTS);

/** A bar with a rounded top, standing on the baseline. */
function barPath(x: number, w: number, y: number, base: number) {
  const r = Math.min(3, w / 2, base - y);
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
}

export function ScoreChart({ games }: { games: PastGame[] }) {
  const y = (v: number) => PAD.top + plotH * (1 - v / 100);
  const label = `Score per game, oldest first: ${games.map((g) => g.score).join(", ")}.`;
  return (
    <Frame label={label} ticks={[100, 50, 0].map((v) => ({ y: y(v), text: String(v) }))}>
      {({ width }) => {
        const slot = slotsFor(games.length, width);
        const barW = Math.min(16, slot - 3);
        return games.map((g, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2;
          return (
            <g key={`${g.playedAt}-${i}`}>
              <title>{`${when(g.playedAt)} · score ${g.score}`}</title>
              <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotH} fill="transparent" />
              {g.score > 0 && <path d={barPath(x, barW, y(g.score), y(0))} className="fill-accent" />}
            </g>
          );
        });
      }}
    </Frame>
  );
}

/** One value per game as a line with dots; games without a value leave a gap. */
export function LineChart({
  games,
  value,
  max,
  format,
  ticks,
  label,
}: {
  games: PastGame[];
  value: (g: PastGame) => number | null;
  max: number;
  format: (v: number) => string;
  ticks: number[];
  label: string;
}) {
  const y = (v: number) => PAD.top + plotH * (1 - Math.min(v, max) / max);
  const points = games.map((g, i) => ({ g, i, v: value(g) }));
  return (
    <Frame label={label} ticks={ticks.map((v) => ({ y: y(v), text: format(v) }))}>
      {({ width }) => {
        const slot = slotsFor(games.length, width);
        const x = (i: number) => PAD.left + i * slot + slot / 2;
        const segments: string[] = [];
        let current = "";
        for (const p of points) {
          if (p.v === null) {
            if (current) segments.push(current);
            current = "";
          } else current += `${current ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`;
        }
        if (current) segments.push(current);
        return (
          <>
            {segments.map((d) => (
              <path key={d} d={d} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {points.map(({ g, i, v }) =>
              v === null ? null : (
                <g key={`${g.playedAt}-${i}`}>
                  <title>{`${when(g.playedAt)} · ${format(v)}`}</title>
                  <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotH} fill="transparent" />
                  <circle cx={x(i)} cy={y(v)} r={4} className="fill-accent stroke-surface" strokeWidth={2} />
                </g>
              ),
            )}
          </>
        );
      }}
    </Frame>
  );
}
