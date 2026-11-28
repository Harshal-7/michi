import type { ReactNode } from "react";

/**
 * One number with its label: "3 h 40 min / studied", "96% / remembered". The number is 22/900, the
 * label 14px ink2. `tone` colours the number for results (good, again).
 *
 * @example <StatTile value="142" label="reviews" />
 */
export function StatTile({
  value,
  label,
  sub,
  tone = "ink",
  size = "md",
}: {
  value: ReactNode;
  label: ReactNode;
  /** A third, quieter line ("best yet"). */
  sub?: ReactNode;
  /** The number's colour. */
  tone?: "ink" | "accent" | "good" | "again";
  /** md 22px number · lg 28px number (results screens). */
  size?: "md" | "lg";
}) {
  const color = { ink: "text-ink", accent: "text-accent", good: "text-good", again: "text-again" }[tone];
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="order-2 text-meta text-ink2">{label}</dt>
      <dd className={`order-1 m-0 font-black ${size === "lg" ? "text-headline" : "text-title"} ${color}`}>{value}</dd>
      {sub !== undefined && <dd className="order-3 m-0 text-caption text-ink2">{sub}</dd>}
    </div>
  );
}

/**
 * A row of StatTiles as a description list, 2–4 across.
 *
 * @example <StatGrid cols={3}><StatTile value="3 h 40 min" label="studied" />…</StatGrid>
 */
export function StatGrid({ cols = 3, children, className }: { cols?: 2 | 3 | 4; children: ReactNode; className?: string }) {
  const grid = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 laptop:grid-cols-4" }[cols];
  return <dl className={`m-0 grid gap-x-4 gap-y-3 ${grid} ${className ?? ""}`}>{children}</dl>;
}
